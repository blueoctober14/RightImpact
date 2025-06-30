from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session, relationship
from fastapi import HTTPException
from models import Base, User, Contact, Message
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from auth.auth import get_current_user



CONTACTS_PER_USER = 50
INACTIVE_THRESHOLD = 15  # minutes

def get_contacts(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Contact).offset(skip).limit(limit).all()

def create_contact(db: Session, contact: dict):
    db_contact = Contact(**contact)
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact

def assign_contacts_to_user(db: Session, user_id: int, count: int = CONTACTS_PER_USER):
    # Get unassigned contacts
    unassigned_contacts = db.query(Contact)\
        .filter(Contact.is_unassigned == True)\
        .limit(count)\
        .all()

    if not unassigned_contacts:
        return []

    # Update contacts to be assigned to this user
    for contact in unassigned_contacts:
        contact.is_unassigned = False
        contact.assigned_to = user_id
        contact.assigned_at = datetime.utcnow()
    
    db.commit()
    return [contact.to_dict() for contact in unassigned_contacts]

    if not unassigned_contacts:
        raise HTTPException(status_code=404, detail="No unassigned contacts available")

    # Assign contacts to user
    for contact in unassigned_contacts:
        contact.assigned_to_id = user_id
        contact.assigned_at = datetime.utcnow()
        contact.is_unassigned = False

    db.commit()
    return [contact.to_dict() for contact in unassigned_contacts]

def release_contacts(db: Session, user_id: int):
    # Get user's assigned contacts
    contacts = db.query(Contact)\
        .filter(Contact.assigned_to_id == user_id)\
        .all()

    if not contacts:
        raise HTTPException(status_code=404, detail="No contacts assigned to user")

    # Release contacts back to pool
    for contact in contacts:
        contact.assigned_to_id = None
        contact.assigned_at = None
        contact.is_unassigned = True
        contact.last_messaged_at = datetime.utcnow()

    db.commit()
    return len(contacts)

def get_assigned_contacts(db: Session, user_id: int):
    return db.query(Contact)\
        .filter(Contact.assigned_to_id == user_id)\
        .all()

def update_last_active(db: Session, user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.last_active = datetime.utcnow()
    db.commit()
    return user

def check_inactive_users(db: Session):
    threshold = datetime.utcnow() - timedelta(minutes=INACTIVE_THRESHOLD)
    inactive_users = db.query(User)\
        .filter(User.last_active < threshold)\
        .all()

    for user in inactive_users:
        release_contacts(db, user.id)

def get_contact_stats(db: Session):
    stats = {
        "assigned": db.query(Contact).filter(Contact.assigned_to_id != None).count(),
        "unassigned": db.query(Contact).filter(Contact.is_unassigned == True).count(),
        "total": db.query(Contact).count()
    }
    return stats
