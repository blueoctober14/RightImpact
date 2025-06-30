from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from datetime import datetime

from models.base import Base

class ContactMatch(Base):
    __tablename__ = "contact_matches"
    __allow_unmapped__ = True

    id = Column(Integer, primary_key=True, index=True)
    shared_contact_id = Column(Integer, ForeignKey("shared_contacts.id", ondelete="CASCADE"), nullable=False)
    target_contact_id = Column(Integer, ForeignKey("target_contacts.id", ondelete="CASCADE"), nullable=False)
    target_list_id = Column(Integer, ForeignKey("target_lists.id", ondelete="CASCADE"), nullable=False)
    match_score = Column(Float, nullable=True)
    match_confidence = Column(String(20), nullable=False)  # 'high', 'medium', 'low'
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
