import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
from auth.dependencies import get_current_user
from models import User
from models.sent_message import SentMessage
from models.messages.message_template import MessageTemplate
from models.shared_contact import SharedContact
from models.user import User as DBUser
from .schemas import SentMessageEnriched
import time
from fastapi.encoders import jsonable_encoder
import json
from utils.cache import redis_cache

from starlette.concurrency import run_in_threadpool

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

try:
    from models.target_contact import TargetContact
except ImportError:
    try:
        from models.targets.target_contact import TargetContact
    except ImportError:
        TargetContact = None  # Fallback if model not found

@router.post("", status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_sent_message(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Record a message as sent to a specific contact
    """
    try:
        logger.info(f"Recording sent message: {request}")
        print(f"[SENT MESSAGES] Received request from user {current_user.id}")
        print(f"[SENT MESSAGES] Request data: {request}")
        
        # Extract data from request
        message_template_id = request.get("message_template_id")
        shared_contact_id = request.get("shared_contact_id")
        
        # Validate required fields
        if not message_template_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="message_template_id is required"
            )
            
        if not shared_contact_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="shared_contact_id is required"
            )
            
        # Check if this message has already been sent to this contact by this user
        existing_sent = db.query(SentMessage).filter(
            SentMessage.message_template_id == message_template_id,
            SentMessage.shared_contact_id == shared_contact_id,
            SentMessage.user_id == current_user.id
        ).first()
        
        if existing_sent:
            print(f"[SENT MESSAGES] Message already exists: {existing_sent.id}")
            # If it already exists, just return success
            return {"status": "success", "message": "Message already marked as sent"}
            
        print("[SENT MESSAGES] Creating new sent message record")
        # Create new sent message record
        new_sent_message = SentMessage(
            message_template_id=message_template_id,
            shared_contact_id=shared_contact_id,
            user_id=current_user.id,
            sent_at=datetime.utcnow()
        )
        
        # Add to database
        db.add(new_sent_message)
        db.commit()
        db.refresh(new_sent_message)
        
        print(f"[SENT MESSAGES] Created record: {new_sent_message.id}")
        return {
            "status": "success",
            "message": "Message marked as sent successfully",
            "data": {
                "id": new_sent_message.id,
                "message_template_id": new_sent_message.message_template_id,
                "shared_contact_id": new_sent_message.shared_contact_id,
                "user_id": new_sent_message.user_id,
                "sent_at": new_sent_message.sent_at
            }
        }
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise e
    except Exception as e:
        logger.error(f"Error recording sent message: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error recording sent message: {str(e)}"
        )

@router.get("/", response_model=List[SentMessageEnriched])
async def get_sent_messages(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    contact_id: Optional[str] = None,
    user_id: Optional[int] = None
):
    start_time = time.time()
    logger.info("[Timing] get_sent_messages: start")
    cache_key = f"sent_messages_{user_id or current_user.id}_{contact_id or 'none'}"
    cached = None
    try:
        cached = await redis_cache.get(cache_key)
    except Exception as e:
        logger.error(f"[Redis] Error reading cache: {e}")
        cached = None
    t0 = time.time()
    logger.info(f"[Timing] after cache check: {t0 - start_time:.3f}s")
    if cached:
        logger.info("[Cache] Returning cached sent messages from Redis")
        elapsed = time.time() - start_time
        logger.info(f"[Timing] get_sent_messages (cache): {elapsed:.3f}s")
        return json.loads(cached)
    try:
        t1 = time.time()
        logger.info(f"[Timing] before DB call: {t1 - start_time:.3f}s")
        def db_query():
            # Use raw SQL for direct fetch
            sql = "SELECT id, message_template_id, shared_contact_id, user_id, sent_at FROM sent_messages"
            conditions = []
            params = {}
            if user_id:
                conditions.append("user_id = :user_id")
                params['user_id'] = user_id
            elif getattr(current_user, 'role', None) != 'admin':
                conditions.append("user_id = :user_id")
                params['user_id'] = current_user.id
            if contact_id:
                conditions.append("shared_contact_id = :contact_id")
                params['contact_id'] = contact_id
            if conditions:
                sql += " WHERE " + " AND ".join(conditions)
            from sqlalchemy import text
            result = db.execute(text(sql), params)
            # Build mock objects to mimic ORM result
            class RawSentMessage:
                def __init__(self, row):
                    self.id = row[0]
                    self.message_template_id = row[1]
                    self.shared_contact_id = row[2]
                    self.user_id = row[3]
                    self.sent_at = row[4]
                    self.user = None
                    self.shared_contact = None
            return [RawSentMessage(row) for row in result.fetchall()]
        sent_messages = await run_in_threadpool(db_query)
        t2 = time.time()
        logger.info(f"[Timing] after DB call: {t2 - t1:.3f}s (total: {t2 - start_time:.3f}s)")
        logger.info(f"[Timing] Loaded {len(sent_messages)} sent messages from DB")

        # Collect all IDs for bulk fetch
        template_ids = list({msg.message_template_id for msg in sent_messages if msg.message_template_id})
        contact_ids = list({msg.shared_contact_id for msg in sent_messages if msg.shared_contact_id})

        t3 = time.time()
        logger.info(f"[Timing] before bulk fetch: {t3 - t2:.3f}s (total: {t3 - start_time:.3f}s)")
        # Bulk fetch related records using raw SQL for performance
        templates = {}
        contacts = {}
        users = {}
        from sqlalchemy import text
        # Fetch templates
        if template_ids:
            t5 = time.time()
            sql = f"SELECT id, name FROM message_templates WHERE id IN ({','.join([':id'+str(i) for i in range(len(template_ids))])})"
            params = {f'id{i}': tid for i, tid in enumerate(template_ids)}
            result = db.execute(text(sql), params)
            for row in result.fetchall():
                templates[str(row[0])] = {'id': row[0], 'name': row[1]}
            t6 = time.time()
            logger.info(f"[Timing] after template fetch: {t6 - t5:.3f}s")
        # Fetch contacts
        if contact_ids:
            t7 = time.time()
            sql = f"SELECT id, first_name, last_name, mobile1 FROM shared_contacts WHERE id IN ({','.join([':id'+str(i) for i in range(len(contact_ids))])})"
            params = {f'id{i}': cid for i, cid in enumerate(contact_ids)}
            result = db.execute(text(sql), params)
            for row in result.fetchall():
                contacts[str(row[0])] = {'id': row[0], 'first_name': row[1], 'last_name': row[2], 'mobile1': row[3]}
            t8 = time.time()
            logger.info(f"[Timing] after contact fetch: {t8 - t7:.3f}s")
        # Fetch users
        user_ids = list({msg.user_id for msg in sent_messages if msg.user_id})
        if user_ids:
            t9 = time.time()
            sql = f"SELECT id, first_name, last_name FROM users WHERE id IN ({','.join([':id'+str(i) for i in range(len(user_ids))])})"
            params = {f'id{i}': uid for i, uid in enumerate(user_ids)}
            result = db.execute(text(sql), params)
            for row in result.fetchall():
                users[row[0]] = {'first_name': row[1], 'last_name': row[2]}
            t10 = time.time()
            logger.info(f"[Timing] after user fetch: {t10 - t9:.3f}s")
        t4 = time.time()
        logger.info(f"[Timing] after bulk fetch: {t4 - t3:.3f}s (total: {t4 - start_time:.3f}s)")

        enrich_start = time.time()
        enriched = []
        for msg in sent_messages:
            template = templates.get(str(msg.message_template_id))
            contact = contacts.get(str(msg.shared_contact_id))
            user = users.get(msg.user_id)
            # Always return a string for username
            if user:
                username = f"{user['first_name']} {user['last_name']}".strip()
            else:
                username = ""
            enriched.append({
                "id": msg.id,
                "message_template_id": str(msg.message_template_id) if msg.message_template_id is not None else None,
                "message_template_name": template['name'] if template else None,
                "shared_contact_id": str(msg.shared_contact_id) if msg.shared_contact_id is not None else None,
                "contact_first_name": contact['first_name'] if contact else None,
                "contact_last_name": contact['last_name'] if contact else None,
                "contact_phone": contact['mobile1'] if contact else None,
                "user_id": msg.user_id,
                "username": username,
                "sent_at": msg.sent_at,
            })
        enrich_time = time.time() - enrich_start
        logger.info(f"[Timing] get_sent_messages (enrichment): {enrich_time:.3f}s")
        try:
            await redis_cache.set(cache_key, json.dumps(jsonable_encoder(enriched)), ex=30)
            logger.info("[Cache] Cached sent messages in Redis")
        except Exception as e:
            logger.error(f"[Redis] Error setting cache: {e}")
        total_time = time.time() - start_time
        logger.info(f"[Timing] get_sent_messages (total): {total_time:.3f}s")
        return enriched

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"[get_sent_messages] ERROR: {str(e)}\nTraceback:\n{tb}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching sent messages: {str(e)}"
        )

@router.post("/neighbors", status_code=status.HTTP_201_CREATED)
async def create_neighbor_sent_message(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Record a neighbor message as sent to a specific contact
    """
    try:
        logger.info(f"Recording neighbor sent message from user {current_user.id}: {request}")
        
        # Extract data from request
        message_template_id = request.get("message_template_id")
        target_contact_id = request.get("target_contact_id")
        
        # Validate required fields
        if not message_template_id:
            logger.error("Missing message_template_id in request")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="message_template_id is required"
            )
            
        if not target_contact_id:
            logger.error("Missing target_contact_id in request")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_contact_id is required"
            )
        
        # Verify message template exists
        message_template = db.query(MessageTemplate).get(message_template_id)
        if not message_template:
            logger.error(f"Message template {message_template_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message template not found"
            )
            
        # Skip target contact verification if model not available
        if TargetContact is not None:
            target_contact = db.query(TargetContact).get(target_contact_id)
            if not target_contact:
                logger.error(f"Target contact {target_contact_id} not found")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Target contact not found"
                )
        else:
            logger.warning("TargetContact model not found - skipping verification")
            
        # Create the sent message record
        sent_message = SentMessage(
            message_template_id=message_template_id,
            user_id=current_user.id,
            target_contact_id=target_contact_id,
            shared_contact_id=None,
            sent_at=datetime.utcnow()
        )
        
        db.add(sent_message)
        db.commit()
        db.refresh(sent_message)
        
        logger.info(f"Successfully recorded neighbor message {sent_message.id}")
        return {"success": True, "message_id": sent_message.id}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception(f"Error recording neighbor sent message: {str(e)}")
        logger.error(f"Request data: {request}")
        logger.error(f"Current user: {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record sent message: {str(e)}"
        )

@router.get("/neighbors", response_model=List[dict])
async def get_neighbor_sent_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all neighbor messages sent by current user
    """
    try:
        sent_messages = db.query(SentMessage).filter(
            SentMessage.user_id == current_user.id,
            SentMessage.target_contact_id != None
        ).all()
        
        return [
            {
                "id": sm.id,
                "message_template_id": sm.message_template_id,
                "target_contact_id": sm.target_contact_id,
                "sent_at": sm.sent_at
            }
            for sm in sent_messages
        ]
    except Exception as e:
        logger.error(f"Error fetching neighbor sent messages: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sent messages"
        )
