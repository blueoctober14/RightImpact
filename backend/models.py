from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Table, func
from sqlalchemy.orm import relationship
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional
from base import Base

# Import models from their respective modules
# Importing these here for type hints and relationships
from models.targets.target_list import TargetList
from models.targets.target_contact import TargetContact
from models.messages.message_template import MessageTemplate

class Contact(Base):
    __tablename__ = "contacts"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    phone_number = Column(String)
    email = Column(String)
    address = Column(String)
    assigned_to_id = Column(Integer, ForeignKey("users.id"))
    is_unassigned = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="assigned_contacts")


# User model has been moved to base.py to avoid circular imports


class ContactMatch(Base):
    __tablename__ = "contact_matches"

    id = Column(Integer, primary_key=True, index=True)
    shared_contact_id = Column(Integer, ForeignKey("shared_contacts.id", ondelete="CASCADE"), nullable=False)
    target_contact_id = Column(Integer, ForeignKey("target_contacts.id", ondelete="CASCADE"), nullable=False)
    target_list_id = Column(Integer, ForeignKey("target_lists.id", ondelete="CASCADE"), nullable=False)
    match_score = Column(Float, nullable=True)
    match_confidence = Column(String(20), nullable=False)  # 'high', 'medium', 'low'
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Relationships - using string references to avoid circular imports
    shared_contact = relationship(
        "SharedContact", 
        back_populates="matches",
        foreign_keys=[shared_contact_id]
    )
    target_contact = relationship(
        "TargetContact", 
        back_populates="matches",
        foreign_keys=[target_contact_id]
    )
    target_list = relationship(
        "TargetList",
        foreign_keys=[target_list_id]
    )


class SharedContact(Base):
    __tablename__ = "shared_contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    matched = Column(Boolean, default=False, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships - using string references to avoid circular imports
    user = relationship("User", back_populates="shared_contacts")
    matched_campaign_contact = relationship("CampaignContact", back_populates="matched_shared_contact", uselist=False)
    matches = relationship(
        "ContactMatch", 
        back_populates="shared_contact", 
        cascade="all, delete-orphan",
        foreign_keys="ContactMatch.shared_contact_id"
    )


class CampaignContact(Base):
    __tablename__ = "campaign_contacts"

    id = Column(Integer, primary_key=True, index=True)
    unique_id = Column(String, unique=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    phone_number = Column(String)
    list_name = Column(String)
    messaged = Column(Boolean, default=False)
    matched_contact_id = Column(Integer, ForeignKey("shared_contacts.id"), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    matched_shared_contact = relationship("SharedContact", back_populates="matched_campaign_contact")
    messages = relationship("Message", back_populates="contact")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), index=True)
    contact_id = Column(Integer, ForeignKey("campaign_contacts.id"), index=True)
    message_type = Column(String)  # 'friend' or 'neighbor'
    message_text = Column(String)
    sent_at = Column(DateTime, default=datetime.utcnow)

    sender = relationship("User", back_populates="messages_sent")
    contact = relationship("CampaignContact", back_populates="messages")




class UserMessageTemplate(Base):
    __tablename__ = "user_message_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    template_id = Column(Integer, ForeignKey("message_templates.id"), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SentMessage(Base):
    __tablename__ = "sent_messages"

    id = Column(Integer, primary_key=True, index=True)
    message_template_id = Column(String, nullable=False, index=True)
    shared_contact_id = Column(String, ForeignKey("shared_contacts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to User
    user = relationship("User", backref="sent_messages")
    from sqlalchemy import cast, Integer
    shared_contact = relationship(
        "SharedContact",
        back_populates="sent_messages",
        primaryjoin="cast(SentMessage.shared_contact_id, Integer)==SharedContact.id",
        foreign_keys=[shared_contact_id]
    )


# Pydantic models
class UserCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    city: str
    state: str
    zip_code: str

class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    city: str
    state: str
    zip_code: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
