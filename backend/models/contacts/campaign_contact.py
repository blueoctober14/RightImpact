from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from models.base import Base

class CampaignContact(Base):
    __tablename__ = "campaign_contacts"
    __allow_unmapped__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    unique_id = Column(String, unique=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    list_name = Column(String, nullable=True)
    messaged = Column(Boolean, default=False)
    matched_contact_id = Column(Integer, ForeignKey("shared_contacts.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    matched_shared_contact = relationship("SharedContact", back_populates="campaign_contacts")
    messages = relationship("Message", back_populates="contact")
