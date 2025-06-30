from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime

from database import get_db
from auth.dependencies import get_current_user
from models import User
from . import schemas, crud
from models.messages.message_template import MessageTemplate as DBMessageTemplate
from models.messages.user_message_template import UserMessageTemplate
from sqlalchemy import func

from models import SentMessage  # <-- add import for SentMessage

def format_template(template: DBMessageTemplate, db: Session = None) -> Dict[str, Any]:
    """Format a message template with its relationships for JSON response."""
    if not template:
        print("[format_template] Warning: template is None")
        # Return a minimal valid response instead of None
        from datetime import datetime
        return {
            "id": 0,
            "name": "",
            "message_type": "friend_to_friend",
            "content": "",
            "media_url": "",
            "status": "INACTIVE",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "lists": [],
            "users": [],
            "groups": []
        }
        
    # Convert the template to a dictionary
    # Handle datetime objects by converting to ISO format strings
    from datetime import datetime
    
    result = {
        "id": template.id,
        "name": template.name,
        "message_type": template.message_type,
        "content": template.content,
        "media_url": template.media_url or "",
        "status": template.status or "INACTIVE",
        "created_at": template.created_at.isoformat() if isinstance(template.created_at, datetime) else (template.created_at or datetime.utcnow().isoformat()),
        "updated_at": template.updated_at.isoformat() if isinstance(template.updated_at, datetime) else (template.updated_at or datetime.utcnow().isoformat()),
        "lists": [],
        "users": [],
        "groups": []
    }
    
    # Add lists if loaded
    if hasattr(template, 'lists') and template.lists is not None:
        result["lists"] = [{"id": lst.id, "name": lst.name} for lst in template.lists]
    
    # Add users if loaded
    if hasattr(template, 'user_assignments') and template.user_assignments is not None:
        for assignment in template.user_assignments:
            if hasattr(assignment, 'user') and assignment.user:
                user = assignment.user
                result["users"].append({
                    "id": user.id,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "email": user.email,
                    "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or f"User {user.id}"
                })
    
    # Always get groups from the DB to ensure accuracy
    if db is not None:
        from sqlalchemy import text
        group_rows = db.execute(
            text("""
            SELECT g.id, g.name FROM groups g
            JOIN message_template_groups mtg ON mtg.group_id = g.id
            WHERE mtg.template_id = :template_id
            """),
            {"template_id": template.id}
        ).fetchall()
        print(f"[DEBUG] Template {template.id} group_rows:", group_rows)
        result["groups"] = [{"id": row[0], "name": row[1]} for row in group_rows]
    elif hasattr(template, 'groups') and template.groups is not None:
        result["groups"] = [{"id": group.id, "name": group.name} for group in template.groups]

    # sent_count is now set in the API route for efficiency
    result["sent_count"] = 0
    return result

router = APIRouter(
    tags=["message-templates"],
    responses={404: {"description": "Not found"}},
)



@router.post("/")
async def create_message_template(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new message template
    """
    try:
        # Get raw request data to debug the issue
        raw_data = await request.json()
        print(f"[DEBUG] Raw template data: {raw_data}")
        
        # Manually validate the data
        template_data = {}
        required_fields = ["name", "message_type", "content"]
        for field in required_fields:
            if field not in raw_data:
                raise HTTPException(status_code=422, detail=f"Missing required field: {field}")
            template_data[field] = raw_data[field]
        
        # Handle optional fields
        if "media_url" in raw_data:
            template_data["media_url"] = raw_data["media_url"]
        
        # Handle status field
        if "status" in raw_data and raw_data["status"]:
            status = str(raw_data["status"]).upper()
            if status not in ["ACTIVE", "INACTIVE", "DRAFT", "ARCHIVED"]:
                print(f"[DEBUG] Invalid status: {status}, defaulting to DRAFT")
                status = "DRAFT"
            template_data["status"] = status
        else:
            template_data["status"] = "DRAFT"
        
        # Handle relationship IDs
        list_ids = raw_data.get("list_ids", []) or []
        user_ids = raw_data.get("user_ids", []) or []
        group_ids = raw_data.get("group_ids", []) or []
        
        print(f"[DEBUG] Processed template data: {template_data}")
        print(f"[DEBUG] Relationships - lists: {list_ids}, users: {user_ids}, groups: {group_ids}")
        
        # Create the template
        db_template = crud.create_message_template(
            db=db,
            template_data=template_data,
            list_ids=list_ids,
            user_ids=user_ids,
            group_ids=group_ids
        )
        
        # Force cache invalidation for all message template patterns
        try:
            print("[CACHE] Invalidating all message template cache patterns")
            await delete_pattern('message_templates*')
            await delete_pattern('message-templates*')
            await delete_pattern('message_template*')
            await delete_pattern('message-template*')
            print("[CACHE] Cache invalidation complete")
        except Exception as e:
            print(f"[CACHE] Error invalidating cache: {e}")
        
        # Return a simple dictionary response
        return {
            "id": db_template.id,
            "name": db_template.name,
            "content": db_template.content,
            "message_type": db_template.message_type,
            "status": db_template.status,
            "created_at": str(db_template.created_at),
            "updated_at": str(db_template.updated_at),
            "media_url": db_template.media_url or "",
            "lists": [],
            "users": [],
            "groups": [],
            "sent_count": 0
        }
    except Exception as e:
        # The crud function already handles rollback
        print(f"Error creating message template: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/user-messages", tags=["message-templates"])
def get_user_messages(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Return all messages assigned to the current user, but only if the user has at least one shared contact matched to a target list assigned to the message.
    For each message, include the matched contacts for this user and that message's target lists.
    """
    import logging
    logging.warning(f"[DEBUG] get_user_messages called. db: {db}, current_user: {getattr(current_user, 'id', None)}")
    from . import crud
    try:
        result = crud.get_user_messages_with_matched_contacts(db, current_user.id)
        logging.warning(f"[DEBUG] get_user_messages result: {result}")
        return result
    except Exception as e:
        logging.error(f"[DEBUG] Exception in get_user_messages: {e}")
        raise

from fastapi.encoders import jsonable_encoder
import json
import time
from utils.cache import redis_cache, delete_pattern

from starlette.concurrency import run_in_threadpool

@router.get("/", response_model=List[schemas.MessageTemplate])
async def read_message_templates(
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve message templates
    """
    start_time = time.time()
    print(f"[Timing] read_message_templates: start")
    # Generate cache key but don't use cache for this high-change endpoint
    cache_key = f"message_templates_{skip}_{limit}_{int(time.time())}"
    print(f"[CACHE] Bypassing cache for message templates list")
    
    # Force delete any existing cache entries for message templates
    try:
        await delete_pattern('message_templates*')
        await delete_pattern('message-templates*')
        print(f"[CACHE] Cleared all message template cache entries")
    except Exception as e:
        print(f"[CACHE] Error clearing cache: {e}")
    
    try:
        t1 = time.time()
        print(f"[Timing] before DB call: {t1 - start_time:.3f}s")
        
        # Create a fresh session for this operation
        fresh_db = next(get_db())
        try:
            templates = await run_in_threadpool(crud.get_message_templates, fresh_db, skip, limit)
            
            # Ensure all relationships are loaded before closing session
            for template in templates:
                if hasattr(template, 'users'):
                    _ = template.users
                if hasattr(template, 'lists'):
                    _ = template.lists
                if hasattr(template, 'groups'):
                    _ = template.groups
        finally:
            fresh_db.close()
        
        t2 = time.time()
        print(f"[Timing] after DB call: {t2 - t1:.3f}s (total: {t2 - start_time:.3f}s)")
        print(f"[Timing] Loaded {len(templates)} templates from DB")
        # Batch fetch sent_counts
        template_ids = [t.id for t in templates]
        sent_counts = {}
        if template_ids:
            sent_counts_query = db.query(SentMessage.message_template_id, func.count(SentMessage.id)).filter(SentMessage.message_template_id.in_(template_ids)).group_by(SentMessage.message_template_id).all()
            sent_counts = {str(tid): count for tid, count in sent_counts_query}
        t3 = time.time()
        print(f"[Timing] after sent_counts batch: {t3 - t2:.3f}s (total: {t3 - start_time:.3f}s)")
        formatted_templates = [format_template(t, db) for t in templates]
        for template_data in formatted_templates:
            template_data["sent_count"] = sent_counts.get(str(template_data["id"]), 0)
        t4 = time.time()
        print(f"[Timing] after formatting: {t4 - t3:.3f}s (total: {t4 - start_time:.3f}s)")
        # Don't cache message templates list to ensure immediate updates
        print("[Cache] Skipping cache for message templates list to ensure immediate updates")
        t5 = time.time()
        print(f"[Timing] after cache set: {t5 - t4:.3f}s (total: {t5 - start_time:.3f}s)")
        elapsed = time.time() - start_time
        print(f"[Timing] read_message_templates (db): {elapsed:.3f}s")
        return formatted_templates
    except Exception as e:
        print(f"[ERROR] Failed to get message templates: {e}")
        # Ensure any open sessions are closed
        if 'fresh_db' in locals() and fresh_db:
            fresh_db.close()
        raise HTTPException(
            status_code=400,
            detail=f"Failed to load message templates: {str(e)}"
        )

@router.get("/neighbors", tags=["message-templates"])
async def get_neighbor_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    contact_limit: int = 10,
    contact_offset: int = 0
):
    """
    Retrieve 'neighbor_to_neighbor' messages for the current user's zip code,
    along with paginated target contacts within that zip code.
    """
    if not current_user.zip_code:
        raise HTTPException(status_code=400, detail="User does not have a zip code defined.")

    try:
        messages_with_contacts = crud.get_neighbor_messages_with_contacts(
            db=db,
            user_id=current_user.id,
            user_zip_code=current_user.zip_code,
            contact_limit_per_message=contact_limit,
            contact_offset_per_message=contact_offset
        )
        return messages_with_contacts
    except Exception as e:
        print(f"Error fetching neighbor messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve neighbor messages: {str(e)}")

@router.get("/{template_id}", response_model=schemas.MessageTemplate)
def read_message_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific message template by ID
    """
    try:
        db_template = crud.get_message_template(db, template_id=template_id)
        if db_template is None:
            raise HTTPException(status_code=404, detail="Message template not found")
        return format_template(db_template, db=db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{template_id}")
async def update_message_template(
    template_id: int,
    template: schemas.MessageTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a message template
    """
    try:
        # Get the current template
        current_template = crud.get_message_template(db, template_id=template_id)
        if not current_template:
            raise HTTPException(status_code=404, detail="Message template not found")
        
        # Prepare update data
        update_data = template.dict(exclude_unset=True, exclude={"list_ids", "user_ids", "group_ids"})
        list_ids = template.list_ids or []
        user_ids = template.user_ids or []
        group_ids = template.group_ids or []
        
        # Ensure status is uppercase if provided
        if 'status' in update_data and update_data['status']:
            if not isinstance(update_data['status'], str):
                update_data['status'] = str(update_data['status'])
            update_data['status'] = update_data['status'].upper()
            
            # Log the status change
            print(f"Status change requested: {current_template.status} -> {update_data['status']}")
            
            # Force update the status directly in the database
            from sqlalchemy import text
            try:
                db.execute(text(f"UPDATE message_templates SET status = '{update_data['status']}' WHERE id = {template_id}"))
                db.commit()
                print(f"Directly updated status in database to {update_data['status']}")
            except Exception as e:
                print(f"Error directly updating status: {e}")
                # Continue with normal update flow
        
        # Update the template
        db_template = crud.update_message_template(
            db=db,
            template_id=template_id,
            template_data=update_data,
            list_ids=list_ids,
            user_ids=user_ids,
            group_ids=group_ids
        )
        
        if db_template is None:
            raise HTTPException(status_code=404, detail="Message template not found")
        
        # Refresh the template to get the latest state
        db.refresh(db_template)
        
        # Force cache invalidation for all message template patterns
        try:
            print("[CACHE] Invalidating all message template cache patterns")
            import asyncio
            await asyncio.gather(
                delete_pattern('message_templates*'),
                delete_pattern('message-templates*'),
                delete_pattern('message_template*'),
                delete_pattern('message-template*'),
                delete_pattern(f'message_template_{template_id}*'),
                delete_pattern(f'message-template-{template_id}*')
            )
            print("[CACHE] Cache invalidation complete")
        except Exception:
            pass
        
        # Get the latest status directly from the database
        from sqlalchemy import text
        try:
            db_status = db.execute(text(f"SELECT status FROM message_templates WHERE id = {template_id}")).fetchone()
            latest_status = db_status[0] if db_status else db_template.status
            print(f"Latest status from database: {latest_status}")
        except Exception as e:
            print(f"Error fetching latest status: {e}")
            latest_status = db_template.status
        
        # Return a simple dictionary response with the latest status from the database
        return {
            "id": db_template.id,
            "name": db_template.name,
            "content": db_template.content,
            "message_type": db_template.message_type,
            "status": latest_status,  # Use the directly queried status
            "created_at": str(db_template.created_at),
            "updated_at": str(db_template.updated_at),
            "media_url": db_template.media_url or "",
            "lists": [],
            "users": [],
            "groups": [],
            "sent_count": 0
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating message template {template_id}: {e}")
        import traceback

@router.get("/{message_id}/contacts", tags=["message-templates"])
async def get_message_contacts(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    offset: int = 0,
    limit: int = 10
):
    """
    Retrieve paginated target contacts for a specific 'neighbor_to_neighbor' message
    that match the current user's zip code.
    """
    if not current_user.zip_code:
        raise HTTPException(status_code=400, detail="User does not have a zip code defined.")

    try:
        contacts_data = crud.get_contacts_for_message(
            db=db,
            message_id=message_id,
            user_zip_code=current_user.zip_code,
            offset=offset,
            limit=limit
        )
        return contacts_data
    except Exception as e:
        print(f"Error fetching contacts for message {message_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve contacts: {str(e)}")

@router.get("/{message_id}/contacts", tags=["message-templates"])
async def get_message_contacts(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    offset: int = 0,
    limit: int = 10
):
    """
    Retrieve paginated target contacts for a specific 'neighbor_to_neighbor' message
    that match the current user's zip code.
    """
    if not current_user.zip_code:
        raise HTTPException(status_code=400, detail="User does not have a zip code defined.")

    try:
        contacts_data = crud.get_contacts_for_message(
            db=db,
            message_id=message_id,
            user_zip_code=current_user.zip_code,
            offset=offset,
            limit=limit
        )
        return contacts_data
    except Exception as e:
        print(f"Error fetching contacts for message {message_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve contacts: {str(e)}")

@router.get("/neighbors", tags=["message-templates"])
async def get_neighbor_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    contact_limit: int = 10,
    contact_offset: int = 0
):
    print(f"[DEBUG] User {current_user.id} - Zip Code: '{current_user.zip_code}'")
    """
    Retrieve 'neighbor_to_neighbor' messages for the current user's zip code,
    along with paginated target contacts within that zip code.
    """
    if not current_user.zip_code:
        raise HTTPException(status_code=400, detail="User does not have a zip code defined.")

    try:
        messages_with_contacts = crud.get_neighbor_messages_with_contacts(
            db=db,
            user_id=current_user.id,
            user_zip_code=current_user.zip_code,
            contact_limit_per_message=contact_limit,
            contact_offset_per_offset=contact_offset
        )
        return messages_with_contacts
    except Exception as e:
        print(f"Error fetching neighbor messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve neighbor messages: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a message template
    """
    try:
        success = crud.delete_message_template(db, template_id=template_id)
        if not success:
            raise HTTPException(status_code=404, detail="Message template not found")
        await delete_pattern('message_templates*')
        return None
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch other exceptions and return 400 with error message
        raise HTTPException(status_code=400, detail=str(e))
