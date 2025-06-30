from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime

from models.base import Base

class TargetContact(Base):
    __tablename__ = "target_contacts"
    __allow_unmapped__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("target_lists.id", ondelete="CASCADE"), nullable=False)
    
    # Required fields
    voter_id = Column(String, nullable=False, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    zip_code = Column(String, nullable=False)
    
    # Optional fields
    address_1 = Column(String, nullable=True)
    address_2 = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    county = Column(String, nullable=True)
    precinct = Column(String, nullable=True)
    cell_1 = Column(String, nullable=True)
    cell_2 = Column(String, nullable=True)
    cell_3 = Column(String, nullable=True)
    landline_1 = Column(String, nullable=True)
    landline_2 = Column(String, nullable=True)
    landline_3 = Column(String, nullable=True)
    email = Column(String, nullable=True)
    party = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Match status
    is_matched = Column(Boolean, default=False)
    match_confidence = Column(String(20), nullable=True)  # 'high', 'medium', 'low'
    match_score = Column(Float, nullable=True)
    
    # Relationship to SentMessage
    sent_messages = relationship(
        "SentMessage",
        primaryjoin="cast(TargetContact.id, String)==SentMessage.target_contact_id",
        foreign_keys="[SentMessage.target_contact_id]"
    )
