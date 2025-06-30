from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from models.base import Base

class Message(Base):
    __tablename__ = "messages"
    __allow_unmapped__ = True

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("campaign_contacts.id"), nullable=True)
    message_type = Column(String, nullable=True)
    message_text = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    
    # Add relationships if needed
    sender = relationship("User", back_populates="messages")
    contact = relationship("CampaignContact", back_populates="messages")
