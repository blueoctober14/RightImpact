from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from database import get_db
from auth.auth import get_current_user, get_admin_user
from models.user import User
from models.contact import Contact
from models.shared_contact import SharedContact
from models.contact_match import ContactMatch
from models.targets.target_list import TargetList
from models.targets.target_contact import TargetContact
from models.messages.message import Message
from sqlalchemy import Table, Column, Integer, String, DateTime, ForeignKey, MetaData
import models
from pydantic import BaseModel, Field
from sqlalchemy import or_, and_, func
from datetime import datetime, timedelta
from . import matching
from .contacts import (
    assign_contacts_to_user,
    release_contacts,
    get_assigned_contacts,
    update_last_active,
    get_contact_stats,
    check_inactive_users
)

# Define skipped_contacts table
skipped_contacts = Table(
    'skipped_contacts',
    MetaData(),
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    Column('shared_contact_id', Integer, ForeignKey('shared_contacts.id', ondelete='CASCADE'), nullable=False),
    Column('created_at', DateTime)
)

router = APIRouter()

@router.get("/contacts")
async def get_assigned_contacts_route(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[Dict]:
    contacts = get_assigned_contacts(db, current_user.id, skip=skip, limit=limit)
    return [contact.to_dict() for contact in contacts]

@router.post("/contacts/assign")
async def assign_contacts_route(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict:
    contacts = assign_contacts_to_user(db, current_user.id)
    return {"contacts": contacts}

@router.post("/contacts/release")
async def release_contacts_route(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict:
    count = release_contacts(db, current_user.id)
    return {"released": count}

@router.post("/user/last-active")
async def update_last_active_route(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict:
    user = update_last_active(db, current_user.id)
    return {"user": user}

@router.get("/contacts/stats")
async def get_contact_stats_route(db: Session = Depends(get_db)) -> Dict:
    return get_contact_stats(db)

@router.post("/contacts/check-inactive")
async def check_inactive_users_route(db: Session = Depends(get_db)) -> Dict:
    check_inactive_users(db)
    return {"message": "Inactive users processed"}

# Match a single shared contact to all target lists
@router.post("/contacts/{shared_contact_id}/match")
async def match_shared_contact(
    shared_contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Match a single shared contact against all target lists
    """
    try:
        matches = matching.match_contact_to_lists(db, shared_contact_id)
        return {
            "status": "success",
            "matches_created": len(matches),
            "shared_contact_id": shared_contact_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Match new shared contacts to target lists with optional filtering
@router.post("/match/new-contacts")
async def match_new_shared_contacts(
    background_tasks: BackgroundTasks,
    user_ids: Optional[List[int]] = Query(None, description="Filter by user IDs"),
    list_ids: Optional[List[int]] = Query(None, description="Filter by target list IDs"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Match newly shared contacts that haven't been matched yet, with optional filtering by user and list
    """
    try:
        # Start building the query for unmatched shared contacts
        query = db.query(SharedContact).filter(
            ~SharedContact.id.in_(
                db.query(ContactMatch.shared_contact_id).distinct()
            )
        )
        
        # Apply user filter if specified
        if user_ids:
            query = query.filter(SharedContact.user_id.in_(user_ids))
        
        shared_contacts = query.all()
        
        if not shared_contacts:
            return {"status": "success", "message": "No new shared contacts to match"}
        
        # If list_ids are provided, we'll handle the filtering in the matching function
        # Otherwise, it will match against all lists
        
        # Add background task to process matching with optional list filtering
        background_tasks.add_task(
            matching.match_new_shared_contacts,
            db,
            [contact.id for contact in shared_contacts],
            list_ids=list_ids  # Pass the list_ids to the matching function
        )
        
        # Build response message
        message = f"Matching {len(shared_contacts)} new shared contacts"
        if user_ids:
            message += f" for {len(user_ids)} selected user(s)"
        if list_ids:
            message += f" against {len(list_ids)} selected list(s)"
        message += " in the background"
        
        return {
            "status": "processing",
            "shared_contacts_count": len(shared_contacts),
            "user_ids": user_ids,
            "list_ids": list_ids,
            "message": message
        }
    except Exception as e:
        logger.error(f"Error in match_new_shared_contacts: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Match a target list to all shared contacts
@router.post("/targets/{target_list_id}/match")
async def match_target_list(
    target_list_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Match all shared contacts against a specific target list
    """
    try:
        # Add background task to process matching
        background_tasks.add_task(
            matching.match_new_target_list,
            db,
            target_list_id
        )
        
        return {
            "status": "processing",
            "target_list_id": target_list_id,
            "message": f"Matching shared contacts to target list {target_list_id} in the background"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Get matches for a shared contact
@router.get("/{shared_contact_id}/matches")
async def get_contact_matches(
    shared_contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Get all matches for a specific shared contact
    """
    # Query matches with target contact details
    matches = db.query(
        ContactMatch,
        TargetContact.voter_id.label('voter_id')
    ).join(
        TargetContact,
        ContactMatch.target_contact_id == TargetContact.id
    ).filter(
        ContactMatch.shared_contact_id == shared_contact_id
    ).all()
    
    return [
        {
            "id": match.ContactMatch.id,
            "target_contact_id": match.ContactMatch.target_contact_id,
            "voter_id": match.voter_id,  # This is the voter ID from the target_contacts table
            "target_list_id": match.ContactMatch.target_list_id,
            "target_list_name": match.ContactMatch.target_list.name if match.ContactMatch.target_list else None,
            "match_confidence": match.ContactMatch.match_confidence,
            "created_at": match.ContactMatch.created_at.isoformat() if match.ContactMatch.created_at else None
        }
        for match in matches
    ]


# Pydantic Schemas for Shared Contacts from Mobile App
class SharedContactPhoneNumberSchema(BaseModel):
    label: str
    number: str

class SharedContactAddressSchema(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = Field(None, alias="zip_code") # Handles both 'zip' and 'zip_code' inputs

class SharedContactCreateSchema(BaseModel):
    firstName: str
    lastName: Optional[str] = None
    company: Optional[str] = None  # This will be set from the mobile app's company field
    phoneNumbers: List[SharedContactPhoneNumberSchema] # Mobile app sends a list
    email: Optional[str] = None
    address: Optional[SharedContactAddressSchema] = None
    
    class Config:
        # This will allow the model to accept additional fields
        # that aren't explicitly defined in the model
        extra = 'allow'

class ShareContactsRequest(BaseModel):
    contacts: List[SharedContactCreateSchema]

@router.post("/share", tags=["contacts"])
async def share_contacts_route(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get raw request body and print it for debugging
    body_bytes = await request.body()
    body_str = body_bytes.decode()
    
    # Parse the JSON data
    try:
        data = await request.json()
        if 'contacts' not in data or not isinstance(data['contacts'], list):
            raise HTTPException(status_code=400, detail="No contacts provided in request")
            
        print(f"Processing {len(data['contacts'])} contacts from user {current_user.id}")
        
    except Exception as e:
        print(f"Error parsing request data: {e}")
        raise HTTPException(status_code=400, detail="Invalid request data")
    
    try:
        request_data = ShareContactsRequest(**data)
    except Exception as e:
        print(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid request format: {e}")
    
    created_count = 0
    print(f"Received {len(request_data.contacts)} contacts to share")
    
    any_contacts_processed = False
    for i, contact_data in enumerate(request_data.contacts):
        # Get the raw contact data for processing
        raw_contact = next((c for c in data['contacts'] 
                          if c.get('firstName') == contact_data.firstName 
                          and c.get('lastName') == contact_data.lastName), None)
        # Skip if both first and last names are blank
        if not contact_data.firstName.strip() and (not contact_data.lastName or not contact_data.lastName.strip()):
            print(f"Skipping contact with no name")
            continue
            
        # Extract and clean up to 3 mobile numbers
        def clean_number(num):
            if not num: 
                return None
                
            # Remove all non-digit characters except leading +
            cleaned = ''.join(c for c in num if c.isdigit() or c == '+')
            
            # If it has a country code
            if cleaned.startswith('+'):
                # If country code is not +1, skip this number
                if not cleaned.startswith('+1'):
                    return None
                # Remove +1 and keep the rest
                cleaned = cleaned[2:]
            
            # Must be exactly 10 digits
            if len(cleaned) != 10:
                return None
                
            return cleaned
        # Process phone numbers
        mobiles = []
        if contact_data.phoneNumbers and len(contact_data.phoneNumbers) > 0:
            for p in contact_data.phoneNumbers:
                if p.label and p.label.lower().startswith('mobile'):
                    cleaned = clean_number(p.number)
                    if cleaned and cleaned not in mobiles:  # Avoid duplicates
                        mobiles.append(cleaned)
                        if len(mobiles) == 3:  # Max 3 numbers per contact
                            break
        
        # Skip if no valid phone numbers
        if not mobiles:
            print(f"Skipping {contact_data.firstName} {contact_data.lastName} - no valid US phone numbers")
            continue
            
        mobile1 = mobiles[0] if len(mobiles) > 0 else None
        mobile2 = mobiles[1] if len(mobiles) > 1 else None
        mobile3 = mobiles[2] if len(mobiles) > 2 else None

        # Split address fields
        addr = contact_data.address or {}
        address = addr.street if hasattr(addr, 'street') else None
        city = addr.city if hasattr(addr, 'city') else None
        state = addr.state if hasattr(addr, 'state') else None
        # Handle both 'zip' and 'zip_code' fields from the mobile app
        zip_code = None
        if hasattr(addr, 'zip_code') and addr.zip_code:
            zip_code = addr.zip_code
        elif hasattr(addr, 'zip') and addr.zip:
            zip_code = addr.zip

        # Build a base query with the required conditions
        query = db.query(SharedContact).filter(
            SharedContact.user_id == current_user.id,
            SharedContact.first_name == contact_data.firstName,
            SharedContact.last_name == (contact_data.lastName or ''),
            or_(
                SharedContact.mobile1 == mobile1,
                SharedContact.mobile2 == mobile1,
                SharedContact.mobile3 == mobile1
            ) if mobile1 else False
        )
        
        # Add optional conditions for other fields if they exist
        if mobile2:
            query = query.filter(or_(
                SharedContact.mobile1 == mobile2,
                SharedContact.mobile2 == mobile2,
                SharedContact.mobile3 == mobile2
            ))
        if mobile3:
            query = query.filter(or_(
                SharedContact.mobile1 == mobile3,
                SharedContact.mobile2 == mobile3,
                SharedContact.mobile3 == mobile3
            ))
            
        # Check for duplicates
        duplicate = query.first()
        
        if duplicate:
            print(f"\n=== DUPLICATE DETECTED ===")
            print(f"Existing: {duplicate.first_name} {duplicate.last_name}")
            print(f"Existing phones: {duplicate.mobile1}, {duplicate.mobile2}, {duplicate.mobile3}")
            print(f"New: {contact_data.firstName} {contact_data.lastName}")
            print(f"New phones: {mobile1}, {mobile2}, {mobile3}")
            print(f"Skipping insert.\n")
            any_contacts_processed = True  # User attempted to share, even if duplicate
            continue

        # Get the company from the contact data
        company = getattr(contact_data, 'company', None)
        
        # If company is not set, try to get it from the raw contact data
        if not company and raw_contact:
            company = raw_contact.get('company')
            
        # Ensure company is properly set (convert empty string to None)
        company = company if company else None
        
        # Create the contact with all fields
        db_shared_contact = SharedContact(
            user_id=current_user.id,
            first_name=contact_data.firstName,
            last_name=contact_data.lastName,
            company=company,  # This will be None if empty/None
            mobile1=mobile1,
            mobile2=mobile2 if mobile2 else None,
            mobile3=mobile3 if mobile3 else None,
            email=contact_data.email if contact_data.email else None,
            address=address if address else None,
            city=city if city else None,
            state=state if state else None,
            zip=zip_code if zip_code else None
        )
        db.add(db_shared_contact)
        created_count += 1
        any_contacts_processed = True
        print(f"Saving shared contact: {contact_data.firstName} {contact_data.lastName} for user {current_user.id}")
    
    # Commit all the new contacts at once
    try:
        db.commit()
        print(f"Successfully saved {created_count} contacts to the database")
    except Exception as e:
        db.rollback()
        print(f"Error saving contacts: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving contacts: {str(e)}")

    # Set has_shared_contacts = True if any contacts were processed (shared or duplicate)
    if any_contacts_processed and not current_user.has_shared_contacts:
        current_user.has_shared_contacts = True
        try:
            db.commit()
            print(f"Set has_shared_contacts = True for user {current_user.id}")
        except Exception as e:
            db.rollback()
            print(f"Error updating has_shared_contacts: {e}")
            # Don't raise error, as sharing itself succeeded

    return {"message": f"{created_count} contacts shared and saved successfully."}

# Utility endpoint for admin to deduplicate existing shared contacts for all users
@router.post("/shared/deduplicate", tags=["contacts"])
async def deduplicate_shared_contacts(db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    """
    Remove duplicate shared contacts for each user (same first_name, last_name, phone_number, email, address). Keeps only the newest (by created_at).
    """
    from sqlalchemy import func
    total_deleted = 0
    users = db.query(User.id).all()
    for (user_id,) in users:
        subq = (
            db.query(
                SharedContact.first_name,
                SharedContact.last_name,
                SharedContact.phone_number,
                SharedContact.email,
                SharedContact.address,
                func.max(SharedContact.created_at).label("max_created_at")
            )
            .filter(SharedContact.user_id == user_id)
            .group_by(
                SharedContact.first_name,
                SharedContact.last_name,
                SharedContact.phone_number,
                SharedContact.email,
                SharedContact.address
            )
            .subquery()
        )
        # Find all duplicates except the newest
        dups = db.query(SharedContact).join(
            subq,
            (SharedContact.first_name == subq.c.first_name) &
            (SharedContact.last_name == subq.c.last_name) &
            (SharedContact.phone_number == subq.c.phone_number) &
            (SharedContact.email == subq.c.email) &
            (SharedContact.address == subq.c.address) &
            (SharedContact.created_at < subq.c.max_created_at)
        ).filter(SharedContact.user_id == user_id).all()
        for dup in dups:
            db.delete(dup)
            total_deleted += 1
    db.commit()
    return {"message": f"Deduplication complete. {total_deleted} duplicate shared contacts deleted."}

# Pydantic model for shared contact response
class AddressResponse(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None

class SharedContactResponse(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    company: Optional[str] = None
    mobile_numbers: Optional[list[str]] = None
    email: Optional[str] = None
    address: Optional[AddressResponse] = None
    user_id: int
    created_at: datetime
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    matched_lists: Optional[list[str]] = None
    match_count: int = 0

    class Config:
        orm_mode = True

class SharedContactsPageResponse(BaseModel):
    contacts: List[SharedContactResponse]
    total: int

import json
import time
import logging
from utils.cache import redis_cache

logger = logging.getLogger(__name__)

@router.get("/shared", response_model=SharedContactsPageResponse, tags=["contacts"])
async def get_shared_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    search: Optional[str] = Query(None, description="Search term for name, email, or phone"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    match_status: Optional[str] = Query(None, description="Filter by match status: 'matched' or 'unmatched'"),
    sort_by: Optional[str] = Query('created_at', description="Field to sort by"),
    sort_order: str = Query('desc', description="Sort order (asc or desc)"),
    skip: int = 0,
    limit: int = 100
):
    """Get all shared contacts (admin only) with Redis caching for performance"""
    start_time = time.time()
    
    # Enforce a hard maximum limit to prevent excessive queries
    if limit > 1000:
        raise HTTPException(status_code=400, detail="Maximum limit is 1000. Please use pagination.")
    
    # Default to a reasonable page size if not specified
    if limit <= 0:
        limit = 500
    
    # Generate cache key based on query parameters
    cache_key = f"shared_contacts:search={search or ''}:user_id={user_id or 'all'}:match_status={match_status or 'all'}:sort_by={sort_by}:sort_order={sort_order}:skip={skip}:limit={limit}:admin={current_user.id}"
    
    # Try to get from cache first
    cached_result = await redis_cache.get(cache_key)
    if cached_result:
        logger.info(f"Cache hit for shared contacts: {cache_key}")
        elapsed = (time.time() - start_time) * 1000
        logger.info(f"Shared contacts retrieved from cache in {elapsed:.2f}ms")
        return json.loads(cached_result)
    
    logger.info(f"Cache miss for shared contacts: {cache_key}")
    query_start = time.time()
    
    # Use a more efficient query with select_from to ensure proper join ordering
    query = db.query(
        SharedContact,
        User.first_name.label('user_first_name'),
        User.last_name.label('user_last_name'),
        User.email.label('user_email')
    ).select_from(SharedContact).join(
        User, SharedContact.user_id == User.id
    )
    
    # Apply user filter if provided
    if user_id is not None and user_id != 'all':
        try:
            user_id_int = int(user_id)
            logger.debug(f"Filtering by user_id: {user_id_int}")
            query = query.filter(SharedContact.user_id == user_id_int)
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid user_id provided: {user_id}")
            return {"contacts": [], "total": 0}
    
    # Log the final query
    logger.debug(f"Final query: {str(query.statement.compile(compile_kwargs={"literal_binds": True}))}")
    
    # Apply match status filter if provided
    if match_status == 'matched':
        # Filter for contacts that have at least one match
        query = query.filter(SharedContact.matches.any())
    elif match_status == 'unmatched':
        # Filter for contacts that have no matches
        query = query.filter(~SharedContact.matches.any())
    
    # Apply search filter if provided
    if search:
        search_term = f"%{search.lower()}%"
        # Create a list of conditions to search across all relevant fields
        search_conditions = [
            SharedContact.first_name.ilike(search_term),
            SharedContact.last_name.ilike(search_term),
            SharedContact.company.ilike(search_term),
            SharedContact.email.ilike(search_term),
            SharedContact.mobile1.ilike(search_term),
            SharedContact.mobile2.ilike(search_term),
            SharedContact.mobile3.ilike(search_term),
            User.first_name.ilike(search_term),
            User.last_name.ilike(search_term),
            User.email.ilike(search_term)
        ]
        
        # Also check if the search term matches any part of the address
        if any(term in search.lower() for term in ['street', 'st', 'ave', 'avenue', 'blvd', 'road', 'rd']):
            search_conditions.extend([
                SharedContact.address.ilike(search_term),
                SharedContact.city.ilike(search_term),
                SharedContact.state.ilike(search_term),
                SharedContact.zip.ilike(search_term)
            ])
        
        # Apply the combined search conditions
        query = query.filter(or_(*search_conditions))
    
    # Handle sorting
    sort_field = None
    sort_model = SharedContact  # Default to SharedContact model
    
    # Map sort fields to their corresponding model and column
    sort_mapping = {
        'id': (SharedContact, 'id'),
        'first_name': (SharedContact, 'first_name'),
        'last_name': (SharedContact, 'last_name'),
        'company': (SharedContact, 'company'),
        'email': (SharedContact, 'email'),
        'created_at': (SharedContact, 'created_at'),
        'user_name': (User, 'last_name'),  # Sort by last name when sorting by user_name
        'user_email': (User, 'email')
    }
    
    # Get the correct model and field for sorting
    sort_model, sort_field_name = sort_mapping.get(sort_by, (SharedContact, 'created_at'))
    sort_field = getattr(sort_model, sort_field_name, None)
    
    # Apply sorting
    if sort_field is not None:
        if sort_order.lower() == 'asc':
            query = query.order_by(sort_field.asc())
        else:
            query = query.order_by(sort_field.desc())
    else:
        # Default to created_at desc if sort field is invalid
        query = query.order_by(SharedContact.created_at.desc())
    
    # Create a count query that mirrors the main query's joins and filters
    count_query = db.query(func.count(SharedContact.id))
    
    # Apply the same join as the main query
    count_query = count_query.select_from(SharedContact).join(
        User, SharedContact.user_id == User.id
    )
    
    # Apply user filter to count query if provided
    if user_id is not None and user_id != 'all':
        try:
            user_id_int = int(user_id)
            logger.debug(f"Filtering count by user_id: {user_id_int}")
            count_query = count_query.filter(SharedContact.user_id == user_id_int)
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid user_id in count query: {user_id}")
            return 0
    
    # Apply match status filter to count query if provided
    if match_status == 'matched':
        count_query = count_query.filter(SharedContact.matches.any())
    elif match_status == 'unmatched':
        count_query = count_query.filter(~SharedContact.matches.any())
    
    # Apply search filter to count query if provided
    if search:
        # Create the same search conditions as the main query
        search_conditions = [
            SharedContact.first_name.ilike(f"%{search.lower()}%"),
            SharedContact.last_name.ilike(f"%{search.lower()}%"),
            SharedContact.company.ilike(f"%{search.lower()}%"),
            SharedContact.email.ilike(f"%{search.lower()}%"),
            SharedContact.mobile1.ilike(f"%{search.lower()}%"),
            SharedContact.mobile2.ilike(f"%{search.lower()}%"),
            SharedContact.mobile3.ilike(f"%{search.lower()}%"),
            User.first_name.ilike(f"%{search.lower()}%"),
            User.last_name.ilike(f"%{search.lower()}%"),
            User.email.ilike(f"%{search.lower()}%")
        ]
        
        # Add address search conditions if needed
        if any(term in search.lower() for term in ['street', 'st', 'ave', 'avenue', 'blvd', 'road', 'rd']):
            search_conditions.extend([
                SharedContact.address.ilike(f"%{search.lower()}%"),
                SharedContact.city.ilike(f"%{search.lower()}%"),
                SharedContact.state.ilike(f"%{search.lower()}%"),
                SharedContact.zip.ilike(f"%{search.lower()}%")
            ])
        
        count_query = count_query.filter(or_(*search_conditions))
    
    logger.debug(f"Count query after filters: {str(count_query.statement.compile(compile_kwargs={'literal_binds': True}))}")
    total_count = count_query.scalar()
    logger.debug(f"Total count after filters: {total_count}")
    
    # Apply pagination and execute the main query
    logger.debug(f"Main query after filters: {str(query.statement.compile(compile_kwargs={'literal_binds': True}))}")
    shared_contacts = query.offset(skip).limit(limit).all()
    
    # Early exit if no contacts found
    if not shared_contacts:
        result = {"contacts": [], "total": 0}
        await redis_cache.set(cache_key, json.dumps(result), ex=30)  # Cache empty results for 30 seconds
        return result
    
    # Get all contact IDs for batch processing
    contact_ids = [contact[0].id for contact in shared_contacts]
    
    # Initialize dictionaries to store match data
    match_count_dict = {}
    contact_matches = {}
    
    if contact_ids:  # Only run these queries if we have contacts
        # Get match counts and list names in a single query using subqueries
        from sqlalchemy.orm import aliased
        
        # Create a subquery for match counts
        match_counts_subq = db.query(
            ContactMatch.shared_contact_id,
            func.count(ContactMatch.id).label('match_count')
        ).join(
            TargetContact, ContactMatch.target_contact_id == TargetContact.id
        ).filter(
            ContactMatch.shared_contact_id.in_(contact_ids)
        ).group_by(
            ContactMatch.shared_contact_id
        ).subquery()
        
        # Create a subquery for matched list names
        matches_subq = db.query(
            ContactMatch.shared_contact_id,
            TargetList.name
        ).join(
            TargetList,
            ContactMatch.target_list_id == TargetList.id
        ).filter(
            ContactMatch.shared_contact_id.in_(contact_ids)
        ).subquery()
        
        # Execute a single query to get all match data
        all_match_data = db.query(
            match_counts_subq.c.shared_contact_id,
            match_counts_subq.c.match_count,
            matches_subq.c.name
        ).outerjoin(
            matches_subq,
            match_counts_subq.c.shared_contact_id == matches_subq.c.shared_contact_id
        ).all()
        
        # Process the results
        for shared_contact_id, match_count, list_name in all_match_data:
            if shared_contact_id not in match_count_dict:
                match_count_dict[shared_contact_id] = 0
                contact_matches[shared_contact_id] = []
            
            if match_count is not None:
                match_count_dict[shared_contact_id] = match_count
            
            if list_name:
                contact_matches[shared_contact_id].append(list_name)
    
    # Format the response to match SharedContactResponse model
    result = []
    for contact, user_first_name, user_last_name, user_email in shared_contacts:
        # Create mobile_numbers list, filtering out None values
        mobile_numbers = [number for number in [contact.mobile1, contact.mobile2, contact.mobile3] if number]
        
        # Get match count for this contact
        match_count = match_count_dict.get(contact.id, 0)
        
        # Create contact dictionary with all fields
        contact_dict = {
            "id": contact.id,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "company": None,  # Not in the model
            "mobile_numbers": [num for num in [contact.mobile1, contact.mobile2, contact.mobile3] if num],
            "email": contact.email,
            "address": {
                "street": contact.address,
                "city": contact.city,
                "state": contact.state,
                "zip": contact.zip
            } if any([contact.address, contact.city, contact.state, contact.zip]) else None,
            "user_id": contact.user_id,
            "user_name": f"{user_first_name or ''} {user_last_name or ''}".strip() or None,
            "user_email": user_email,
            "created_at": contact.created_at.isoformat(),
            "match_count": match_count,
            "matched_lists": contact_matches.get(contact.id, [])
        }
        result.append(contact_dict)
    
    # Convert datetime objects to ISO format strings
    def convert_datetime(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {k: convert_datetime(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_datetime(item) for item in obj]
        return obj
    
    # Prepare and convert response
    response = {"contacts": convert_datetime(result), "total": total_count}
    
    # Cache the result for 60 seconds
    try:
        await redis_cache.set(cache_key, json.dumps(response), ex=60)
    except Exception as e:
        logger.error(f"Error caching shared contacts: {e}")
    
    # Log performance metrics
    query_time = (time.time() - query_start) * 1000
    total_time = (time.time() - start_time) * 1000
    logger.info(f"Shared contacts query executed in {query_time:.2f}ms, total processing time: {total_time:.2f}ms")
    
    return response


# Skipped Contacts API endpoints
@router.post("/skip")
async def skip_contact(
    shared_contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Skip a contact permanently for a user
    """
    try:
        # Check if the contact is already skipped
        existing_skip = db.query(skipped_contacts).filter(
            skipped_contacts.c.user_id == current_user.id,
            skipped_contacts.c.shared_contact_id == shared_contact_id
        ).first()
        
        if existing_skip:
            return {"status": "already_skipped", "message": "Contact was already skipped"}
        
        # Insert into skipped_contacts table
        db.execute(
            skipped_contacts.insert().values(
                user_id=current_user.id,
                shared_contact_id=shared_contact_id,
                created_at=datetime.now()
            )
        )
        db.commit()
        
        return {"status": "success", "message": "Contact skipped successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/skipped")
async def get_skipped_contacts(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all skipped contacts for the current user
    """
    try:
        # Get skipped contact IDs for the current user
        skipped_contact_ids = db.query(skipped_contacts.c.shared_contact_id).filter(
            skipped_contacts.c.user_id == current_user.id
        ).all()
        
        # Convert to list of IDs
        skipped_ids = [id[0] for id in skipped_contact_ids]
        
        if not skipped_ids:
            return {"contacts": [], "total": 0}
        
        # Get the actual contact details
        skipped_contact_list = db.query(SharedContact).filter(
            SharedContact.id.in_(skipped_ids)
        ).offset(skip).limit(limit).all()
        
        # Count total skipped contacts
        total_count = db.query(func.count(skipped_contacts.c.id)).filter(
            skipped_contacts.c.user_id == current_user.id
        ).scalar()
        
        # Convert to response format
        contacts_response = []
        for contact in skipped_contact_list:
            mobile_numbers = []
            if contact.mobile1:
                mobile_numbers.append(contact.mobile1)
            if contact.mobile2:
                mobile_numbers.append(contact.mobile2)
            if contact.mobile3:
                mobile_numbers.append(contact.mobile3)
                
            contacts_response.append({
                "id": contact.id,
                "shared_contact_id": contact.id,
                "first_name": contact.first_name,
                "last_name": contact.last_name,
                "mobile_numbers": mobile_numbers,
                "email": contact.email,
                "company": contact.company,
                "created_at": contact.created_at.isoformat() if contact.created_at else None
            })
        
        return {"contacts": contacts_response, "total": total_count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/skip/{shared_contact_id}")
async def unskip_contact(
    shared_contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a contact from the skipped list
    """
    try:
        # Delete from skipped_contacts table
        result = db.execute(
            skipped_contacts.delete().where(
                and_(
                    skipped_contacts.c.user_id == current_user.id,
                    skipped_contacts.c.shared_contact_id == shared_contact_id
                )
            )
        )
        db.commit()
        
        if result.rowcount == 0:
            return {"status": "not_found", "message": "Contact was not in skipped list"}
        
        return {"status": "success", "message": "Contact removed from skipped list"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
