# Standard library imports
import csv
import io
import json
import logging
from typing import List, Optional
from datetime import datetime

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status, BackgroundTasks, File, Form
from sqlalchemy.orm import Session

# Application imports
from database import get_db
from auth.dependencies import get_current_user
from models.user import User
from models.contacts.campaign_contact import CampaignContact as TargetContact

# Set up logger at the top after imports
logger = logging.getLogger(__name__)

# Local imports
from . import crud, schemas

router = APIRouter(
    prefix="",  # Removed "/targets" prefix since it's included in main.py
    tags=["targets"]
    # Removed authentication dependency for development
)

@router.post("/lists/", response_model=schemas.TargetList)
def create_target_list(
    target_list: schemas.TargetListCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new target list
    """
    return crud.create_target_list(db=db, target_list=target_list)

def process_csv_import(
    file: UploadFile, 
    db: Session, 
    list_id: int, 
    field_mapping: dict
):
    print(f"\n=== Starting process_csv_import for list_id: {list_id} ===")
    print(f"Field mapping: {field_mapping}")
    
    try:
        # Get the target list
        db_list = crud.get_target_list(db, list_id)
        if not db_list:
            print(f"Error: Target list with ID {list_id} not found")
            return
        
        print(f"Processing target list: {db_list.name} (ID: {db_list.id})")
        
        # Update list status to processing
        db_list.status = schemas.ImportStatus.PROCESSING
        db.commit()
        db.refresh(db_list)
        print("Set list status to PROCESSING")
        
        # Read and process the CSV file
        print("Reading file content...")
        try:
            if hasattr(file, 'file'):
                # Handle UploadFile
                content = file.file.read()
            else:
                # Handle BytesIO
                file.seek(0)  # Rewind to the start of the file
                content = file.read()
            
            # Decode with utf-8-sig to handle BOM
            content_str = content.decode('utf-8-sig')
            print(f"Read {len(content_str)} bytes from file")
            
            # Clean up any remaining BOM characters from field names
            csv_reader = csv.DictReader(io.StringIO(content_str))
            print(f"CSV fields: {csv_reader.fieldnames}")
            
            required_fields = ['voter_id', 'first_name', 'last_name', 'zip_code', 'cell_1']
            
            # The field_mapping should be in the format: {'voter_id': 'csv_column_name', ...}
            # We need to map the CSV column names to the database field names
            mapped_fields = {}
            for db_field, csv_column in field_mapping.items():
                if csv_column:  # Only add if a CSV column is mapped
                    mapped_fields[db_field] = csv_column
            
            print(f"Mapped fields: {mapped_fields}")
            
            # Check if all required fields are mapped
            missing_fields = [f for f in required_fields if f not in field_mapping or not field_mapping[f]]
            if missing_fields:
                error_msg = f"Missing required field mappings: {', '.join(missing_fields)}. The Phone 1 field is required for all imports."
                print(f"Error: {error_msg}")
                db_list.status = schemas.ImportStatus.FAILED
                db_list.error_message = error_msg
                db.commit()
                return
            
            # Process contacts in batches
            batch_size = 5000  # Increased from 1000 to 5000 for better performance
            batch = []
            total_imported = 0
            total_failed = 0
            
            print("Starting to process CSV rows...")
            for i, row in enumerate(csv_reader, 1):
                try:
                    # Map CSV columns to our model fields using the field mapping
                    contact_data = {}
                    for model_field, csv_column in field_mapping.items():
                        if not csv_column:  # Skip if no CSV column is mapped to this field
                            continue
                            
                        # Clean the CSV column name by removing BOM if present
                        clean_csv_column = csv_column.strip('\ufeff')
                            
                        # Handle case where CSV column might be in the row
                        if clean_csv_column in row and row[clean_csv_column] and str(row[clean_csv_column]).strip():
                            # Clean the value
                            value = str(row[clean_csv_column]).strip()
                            
                            # Special handling for phone numbers to clean them up
                            if model_field in ['cell_1', 'cell_2', 'cell_3', 'landline_1', 'landline_2', 'landline_3']:
                                # Remove any non-digit characters
                                value = ''.join(c for c in value if c.isdigit())
                                # Only include if it has at least 10 digits (US/Canada format)
                                if len(value) >= 10:
                                    contact_data[model_field] = value
                            else:
                                contact_data[model_field] = value
                    
                    # Debug log for the first few rows
                    if i <= 3:  # Only log first 3 rows to avoid flooding logs
                        print(f"Processed row {i} data: {contact_data}")
                    
                    # Skip if required fields are missing
                    if not all(field in contact_data for field in required_fields):
                        total_failed += 1
                        if total_failed <= 5:  # Only log first few failures to avoid flooding logs
                            missing = [f for f in required_fields if f not in contact_data]
                            print(f"Skipping row {i} - Missing required fields: {missing}. Data: {row}")
                        continue
                    
                    # Create contact
                    contact = schemas.TargetContactCreate(**contact_data)
                    batch.append(contact.dict())
                    
                    # Insert batch when it reaches the batch size
                    if len(batch) >= batch_size:
                        print(f"Inserting batch of {len(batch)} contacts...")
                        crud.bulk_create_target_contacts(db, batch, list_id)
                        total_imported += len(batch)
                        batch = []
                        
                        # Update progress
                        db_list.imported_contacts = total_imported
                        db_list.failed_contacts = total_failed
                        db.commit()
                        print(f"Progress: {total_imported} imported, {total_failed} failed")
                        
                except Exception as e:
                    total_failed += 1
                    print(f"Error processing row {i}: {str(e)}")
                    continue
            
            # Insert any remaining contacts
            if batch:
                print(f"Inserting final batch of {len(batch)} contacts...")
                crud.bulk_create_target_contacts(db, batch, list_id)
                total_imported += len(batch)
            
            # Update list status and counts
            db_list.status = schemas.ImportStatus.COMPLETED
            db_list.imported_contacts = total_imported
            db_list.failed_contacts = total_failed
            db_list.total_contacts = total_imported + total_failed
            # Ensure removed_contacts is not modified during import
            if hasattr(db_list, 'removed_contacts'):
                db_list.removed_contacts = max(0, getattr(db_list, 'removed_contacts', 0))
            db.commit()
            
            print(f"Import completed successfully. Imported: {total_imported}, Failed: {total_failed}")
            
        except Exception as e:
            error_msg = f"Error processing file: {str(e)}"
            print(error_msg)
            raise e
            
    except Exception as e:
        # Update list status to failed if any error occurs
        error_msg = f"Unexpected error in process_csv_import: {str(e)}"
        print(error_msg)
        
        try:
            db.rollback()
            if 'db_list' in locals():
                db_list.status = schemas.ImportStatus.FAILED
                db_list.error_message = str(e)[:500]  # Truncate error message if too long
                db.commit()
                print(f"Updated list status to FAILED with error: {db_list.error_message}")
        except Exception as db_error:
            print(f"Error updating database with error status: {str(db_error)}")
            
        # Re-raise the exception to ensure it's logged by the background task handler
        raise

@router.post("/remove_voters")
async def remove_voters(
    list_id: Optional[int] = Form(None),  # None => all lists
    voter_ids_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Remove voters (TargetContacts) by voter_id from a specific list or all lists.

    Accepts voter IDs via plain-text (one per line / comma-separated) or a CSV
    file containing a single column with voter IDs.
    """
    if not voter_ids_text and not file:
        raise HTTPException(status_code=400, detail="Either voter_ids_text or file is required")

    voter_ids: List[str] = []
    if voter_ids_text:
        for token in voter_ids_text.replace(",", "\n").splitlines():
            token = token.strip()
            if token:
                voter_ids.append(token)

    if file:
        try:
            content = (await file.read()).decode("utf-8")
            reader = csv.reader(io.StringIO(content))
            for row in reader:
                if row and row[0].strip():
                    voter_ids.append(row[0].strip())
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read CSV: {str(e)}")

    if not voter_ids:
        raise HTTPException(status_code=400, detail="No voter IDs provided")

    # remove duplicates
    voter_ids = list(set(voter_ids))

    deleted_count = crud.delete_contacts_by_voter_ids(db, voter_ids, list_id=list_id)
    return {
        "deleted": deleted_count,
        "voter_ids_count": len(voter_ids),
        "list_id": list_id,
    }


@router.post("/import", response_model=schemas.TargetImportResponse)
async def import_targets(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    list_name: str = Form(...),
    description: str = Form(None),
    field_mapping: str = Form(...),
    db: Session = Depends(get_db)
):
    print("\n=== Starting import_targets ===")
    try:
        print(f"Received import request for file: {file.filename}")
        print(f"List name: {list_name}")
        print(f"Description: {description}")
        print(f"Field mapping: {field_mapping}")
        
        # Handle field_mapping (it should already be a dictionary from the frontend)
        if isinstance(field_mapping, str):
            try:
                field_mapping_dict = json.loads(field_mapping)
                print("Successfully parsed field mapping from string:", field_mapping_dict)
            except json.JSONDecodeError as e:
                error_msg = f"Failed to parse field_mapping: {e}"
                print(error_msg)
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid field_mapping format. Must be a valid JSON string: {str(e)}"
                )
        elif isinstance(field_mapping, dict):
            field_mapping_dict = field_mapping
            print("Received field mapping as dictionary:", field_mapping_dict)
        else:
            error_msg = f"Invalid field_mapping type: {type(field_mapping)}. Expected string or dict."
            print(error_msg)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=error_msg
            )
        
        # Create the target list
        try:
            print("Creating target list...")
            db_list = crud.create_target_list(db, schemas.TargetListCreate(
                name=list_name,
                description=description or f"Imported from {file.filename}",
                status=schemas.ImportStatus.PROCESSING  # Explicitly set status to processing
            ))
            db.refresh(db_list)
            print(f"Created target list with ID: {db_list.id}")
        except Exception as e:
            error_msg = f"Failed to create target list: {str(e)}"
            print(error_msg)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )
        
        # Read the file content here while the file is still available
        try:
            print("Reading file content...")
            content = await file.read()
            print(f"Read {len(content)} bytes from file")
            
            if not content:
                error_msg = "Uploaded file is empty"
                print(error_msg)
                # Update list status to failed
                db_list.status = schemas.ImportStatus.FAILED
                db_list.error_message = error_msg
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )
            
            # Create a new file-like object with the content
            from io import BytesIO
            file_obj = BytesIO(content)
            file_obj.name = file.filename
            
            print("Starting background task for CSV processing...")
            # Start background task to process the CSV
            background_tasks.add_task(
                process_csv_import,
                file=file_obj,
                db=db,
                list_id=db_list.id,
                field_mapping=field_mapping_dict
            )
            
            print("Background task started successfully")
            
            response = {
                "import_id": db_list.id,
                "status": "processing",
                "message": f"Import of {file.filename} has started"
            }
            print("Returning response:", response)
            return response
            
        except Exception as e:
            print(f"Error processing file: {str(e)}")
            # Update list status to failed
            db_list.status = schemas.ImportStatus.FAILED
            db_list.error_message = f"Failed to process file: {str(e)}"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process file: {str(e)}"
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Unexpected error in import_targets: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.get("/lists", response_model=schemas.TargetListResponse)
def get_all_lists(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get all target lists with pagination and optional status filtering.
    Returns a dictionary with 'lists' (the paginated results) and 'total' (total count).
    """
    _logger = logging.getLogger(__name__)
    
    try:
        # Get paginated lists and total count in a single database operation
        # The crud function will handle its own transaction
        lists_data = crud.get_target_lists(db, skip=skip, limit=limit, status=status)
        total = crud.get_target_lists(db, status=status, count_only=True)
        
        if lists_data is None or total is None:
            _logger.error("Failed to fetch target lists or count")
            raise HTTPException(
                status_code=500,
                detail="Failed to fetch target lists"
            )
            
        return {"lists": lists_data, "total": total}
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
        
    except Exception as e:
        _logger.error("Error in get_all_lists: %s", str(e), exc_info=True)
        
        # Ensure we don't try to use a broken session
        try:
            db.rollback()
        except Exception as rollback_error:
            _logger.error("Error rolling back transaction: %s", str(rollback_error))
        
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fetching target lists"
        )

@router.get("/lists/{list_id}", response_model=schemas.TargetList)
def get_list(
    list_id: int,
    db: Session = Depends(get_db)
):
    try:
        with db.begin():
            db_list = crud.get_target_list(db, list_id)
            if not db_list:
                raise HTTPException(status_code=404, detail="Target list not found")
            
            # Convert to dict to avoid detached instance errors
            return {
                "id": db_list.id,
                "name": db_list.name,
                "description": db_list.description,
                "total_contacts": db_list.total_contacts,
                "imported_contacts": db_list.imported_contacts,
                "failed_contacts": db_list.failed_contacts,
                "status": db_list.status,
                "created_at": db_list.created_at.isoformat() if db_list.created_at else None,
                "updated_at": db_list.updated_at.isoformat() if db_list.updated_at else None
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_list for list_id {list_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fetching the target list"
        )

@router.get("/contacts", response_model=schemas.TargetContactResponse)
def get_contacts(
    list_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    contacts = crud.get_target_contacts(
        db, 
        list_id=list_id, 
        skip=skip, 
        limit=limit,
        search=search
    )
    total = crud.count_target_contacts(db, list_id=list_id, search=search)
    
    response = {
        "contacts": contacts,
        "total": total
    }
    
    if list_id:
        db_list = crud.get_target_list(db, list_id)
        if db_list:
            response["list_id"] = list_id
            response["list_name"] = db_list.name
    
    return response

@router.get("/contacts/{contact_id}", response_model=schemas.TargetContact)
def get_contact(
    contact_id: int,
    db: Session = Depends(get_db)
):
    contact = db.query(TargetContact).filter(TargetContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@router.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(
    list_id: int,
    db: Session = Depends(get_db)
):
    if not crud.delete_target_list(db, list_id):
        raise HTTPException(status_code=404, detail="Target list not found")
    return None

@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db)
):
    if not crud.delete_target_contact(db, contact_id):
        raise HTTPException(status_code=404, detail="Contact not found")
    return None
