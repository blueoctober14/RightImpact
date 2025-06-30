import csv
import json
from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from io import StringIO
from sqlalchemy.orm import Session

from auth.dependencies import get_db, get_current_user
from models.user import User
from models.contact import Contact

router = APIRouter()

# Helper functions for CSV export
def generate_csv(data: List[Dict[str, Any]], headers: List[str]) -> StreamingResponse:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    writer.writerows(data)
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )

def generate_json(data: List[Dict[str, Any]]) -> StreamingResponse:
    return StreamingResponse(
        json.dumps(data, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        }
    )

@router.get("/users/export", tags=["export"])
async def export_users(
    format: str = "csv",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export all users data.
    
    Args:
        format: Output format (csv or json)
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    users = db.query(User).all()
    
    user_data = [
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone_number": user.phone_number,
            "created_at": user.created_at.isoformat(),
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "assigned_contacts": len(user.contacts)
        }
        for user in users
    ]

    if format == "csv":
        headers = list(user_data[0].keys()) if user_data else []
        return generate_csv(user_data, headers)
    elif format == "json":
        return generate_json(user_data)
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Must be 'csv' or 'json'")

@router.get("/contacts/export", tags=["export"])
async def export_contacts(
    format: str = "csv",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export all contacts data.
    
    Args:
        format: Output format (csv or json)
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    contacts = db.query(Contact).all()
    
    contact_data = [
        {
            "id": contact.id,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "phone_number": contact.phone_number,
            "email": contact.email,
            "address": contact.address,
            "city": contact.city,
            "state": contact.state,
            "zip_code": contact.zip_code,
            "assigned_to": contact.assigned_to_id,
            "created_at": contact.created_at.isoformat(),
            "last_contacted": contact.last_contacted.isoformat() if contact.last_contacted else None,
            "status": contact.status
        }
        for contact in contacts
    ]

    if format == "csv":
        headers = list(contact_data[0].keys()) if contact_data else []
        return generate_csv(contact_data, headers)
    elif format == "json":
        return generate_json(contact_data)
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Must be 'csv' or 'json'")
