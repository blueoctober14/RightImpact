import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

# Set up logging
logger = logging.getLogger(__name__)

# Local imports
from . import schemas
from models.targets.target_list import TargetList
from models.targets.target_contact import TargetContact

# Alias models for backward compatibility
models = type('models', (), {
    'TargetList': TargetList,
    'TargetContact': TargetContact
})()

def create_target_list(db: Session, target_list: schemas.TargetListCreate) -> models.TargetList:
    db_target_list = models.TargetList(
        name=target_list.name,
        description=target_list.description,
        status=schemas.ImportStatus.PENDING
    )
    db.add(db_target_list)
    db.commit()
    db.refresh(db_target_list)
    return db_target_list

def get_target_list(db: Session, list_id: int) -> Optional[models.TargetList]:
    return db.query(models.TargetList).filter(models.TargetList.id == list_id).first()

def get_target_lists(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    status: Optional[str] = None,
    count_only: bool = False
) -> List[Dict[str, Any]]:
    """
    Get target lists with optional filtering and pagination.
    If count_only is True, returns the total count instead of the records.
    This function handles cases where database objects might be detached.
    
    Returns:
        List[Dict]: List of target list dictionaries when count_only is False
        int: Total count when count_only is True
    """
    _logger = logging.getLogger(__name__)
    try:
        # Use existing session but ensure we're not in a transaction
        if db.in_transaction():
            db.commit()
            
        # For count_only, just return the count without any joins
        if count_only:
            query = db.query(models.TargetList)
            if status:
                query = query.filter(models.TargetList.status == status)
            return query.count()
        
        # For normal queries, explicitly select only the fields we need
        # This avoids any relationship loading issues
        query = db.query(
            models.TargetList.id,
            models.TargetList.name,
            models.TargetList.description,
            models.TargetList.status,
            models.TargetList.total_contacts,
            models.TargetList.imported_contacts,
            models.TargetList.failed_contacts,
            models.TargetList.created_at,
            models.TargetList.updated_at
        )
        
        if status:
            query = query.filter(models.TargetList.status == status)
        
        # Execute the query and get results as dictionaries
        results = query.offset(skip).limit(limit).all()
        
        # Convert to list of dictionaries
        safe_results = []
        for row in results:
            try:
                safe_item = {
                    'id': row.id,
                    'name': row.name,
                    'description': row.description,
                    'status': row.status,
                    'total_contacts': row.total_contacts or 0,
                    'imported_contacts': row.imported_contacts or 0,
                    'failed_contacts': row.failed_contacts or 0,
                    'created_at': row.created_at.isoformat() if row.created_at else None,
                    'updated_at': row.updated_at.isoformat() if row.updated_at else None
                }
                safe_results.append(safe_item)
            except Exception as item_error:
                _logger.warning("Error processing list item: %s", str(item_error))
                continue
                
        return safe_results
        
    except Exception as e:
        _logger.error("Error in get_target_lists: %s", str(e), exc_info=True)
        # Make sure to rollback the session on error
        try:
            db.rollback()
        except:
            _logger.error("Error rolling back transaction")
        raise

def update_target_list(
    db: Session, 
    db_target_list: models.TargetList, 
    target_list_update: schemas.TargetListUpdate
) -> models.TargetList:
    update_data = target_list_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_target_list, field, value)
    db_target_list.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_target_list)
    return db_target_list

def delete_target_list(db: Session, list_id: int) -> bool:
    db_target_list = get_target_list(db, list_id)
    if not db_target_list:
        return False
    
    # First, delete all associated contacts
    db.query(models.TargetContact).filter(
        models.TargetContact.list_id == list_id
    ).delete(synchronize_session=False)
    
    # Then delete the list
    db.delete(db_target_list)
    db.commit()
    return True

def create_target_contact(
    db: Session, 
    contact: schemas.TargetContactCreate, 
    list_id: int
) -> models.TargetContact:
    db_contact = models.TargetContact(
        **contact.dict(),
        list_id=list_id
    )
    db.add(db_contact)
    return db_contact

def bulk_create_target_contacts(
    db: Session, 
    contacts: List[Dict[str, Any]], 
    list_id: int
) -> None:
    db.bulk_insert_mappings(
        models.TargetContact,
        [{"list_id": list_id, **contact} for contact in contacts]
    )

def get_target_contacts(
    db: Session,
    list_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None
) -> List[models.TargetContact]:
    query = db.query(models.TargetContact)
    
    if list_id is not None:
        query = query.filter(models.TargetContact.list_id == list_id)
    
    if search:
        search_filter = (
            models.TargetContact.first_name.ilike(f"%{search}%") |
            models.TargetContact.last_name.ilike(f"%{search}%") |
            models.TargetContact.voter_id.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)
    
    return query.offset(skip).limit(limit).all()

def count_target_contacts(
    db: Session,
    list_id: Optional[int] = None,
    search: Optional[str] = None
) -> int:
    query = db.query(models.TargetContact)
    
    if list_id is not None:
        query = query.filter(models.TargetContact.list_id == list_id)
    
    if search:
        search_filter = (
            models.TargetContact.first_name.ilike(f"%{search}%") |
            models.TargetContact.last_name.ilike(f"%{search}%") |
            models.TargetContact.voter_id.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)
    
    return query.count()

def get_contact_by_voter_id(
    db: Session, 
    voter_id: str, 
    list_id: int
) -> Optional[models.TargetContact]:
    return db.query(models.TargetContact).filter(
        models.TargetContact.voter_id == voter_id,
        models.TargetContact.list_id == list_id
    ).first()

def update_target_contact(
    db: Session,
    db_contact: models.TargetContact,
    contact_update: schemas.TargetContactCreate
) -> models.TargetContact:
    update_data = contact_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_contact, field, value)
    db_contact.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_contact)
    return db_contact

def delete_target_contact(db: Session, contact_id: int) -> bool:
    db_contact = db.query(models.TargetContact).filter(models.TargetContact.id == contact_id).first()
    if not db_contact:
        return False
    db.delete(db_contact)
    db.commit()
    return True

# -----------------------------------------------------------
# Helper: delete contacts by voter IDs (with optional list_id)
# -----------------------------------------------------------

def delete_contacts_by_voter_ids(
    db: Session,
    voter_ids: List[str],
    list_id: Optional[int] = None,
) -> int:
    """Delete TargetContact rows matching the supplied voter_ids.

    Also updates TargetList counts and SharedContact.matched flag to reflect
    the deletions.
    """
    if not voter_ids:
        return 0

    # Query contacts to delete
    q = db.query(models.TargetContact).filter(models.TargetContact.voter_id.in_(voter_ids))
    if list_id is not None:
        q = q.filter(models.TargetContact.list_id == list_id)

    contacts_to_delete = q.all()
    if not contacts_to_delete:
        return 0

    target_contact_ids = [c.id for c in contacts_to_delete]
    affected_list_ids = list({c.list_id for c in contacts_to_delete})

    # Collect shared_contact_ids linked through ContactMatch table
    from models.contact_match import ContactMatch  # type: ignore
    from models.shared_contact import SharedContact  # type: ignore

    shared_contact_ids = [row.shared_contact_id for row in db.query(ContactMatch.shared_contact_id)
                          .filter(ContactMatch.target_contact_id.in_(target_contact_ids))
                          .distinct()]

    # Delete any ContactMatch rows linked to these target contacts
    db.query(ContactMatch).filter(ContactMatch.target_contact_id.in_(target_contact_ids)).delete(synchronize_session=False)

    # Perform bulk delete of the target contacts
    q.delete(synchronize_session=False)

    # Update stats for affected lists
    for tl_id in affected_list_ids:
        tl = db.query(models.TargetList).filter(models.TargetList.id == tl_id).first()
        if tl:
            remaining = db.query(models.TargetContact).filter(models.TargetContact.list_id == tl_id).count()
            tl.total_contacts = remaining
            tl.updated_at = datetime.utcnow()

    # Update SharedContact.matched flags
    if shared_contact_ids:
        still_matched_ids = [row.shared_contact_id for row in db.query(ContactMatch.shared_contact_id)
                             .filter(ContactMatch.shared_contact_id.in_(shared_contact_ids))
                             .distinct()]
        for sc_id in shared_contact_ids:
            if sc_id not in still_matched_ids:
                sc = db.query(SharedContact).get(sc_id)
                if sc:
                    sc.matched = False

    db.commit()
    return len(target_contact_ids)
