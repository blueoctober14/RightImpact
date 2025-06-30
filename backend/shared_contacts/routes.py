"""
Shared Contacts API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from auth.dependencies import get_current_user
from models import User
from models.shared_contact import SharedContact
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/shared_contacts", tags=["shared_contacts"])

@router.get("/my_contacts", response_model=List[dict])
async def get_my_shared_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all shared contacts belonging to current user
    Returns contacts with mobile1 and mobile2 fields
    """
    try:
        contacts = db.query(SharedContact).filter(
            SharedContact.user_id == current_user.id
        ).all()
        
        return [
            {
                "id": contact.id,
                "mobile1": contact.mobile1,
                "mobile2": contact.mobile2,
                "user_id": contact.user_id
            }
            for contact in contacts
        ]
    except Exception as e:
        logger.error(f"Error fetching shared contacts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch shared contacts"
        )
