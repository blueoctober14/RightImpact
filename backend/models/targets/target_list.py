from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum as PyEnum

from models.base import Base
from models.associations import message_template_lists

class ImportStatus(str, PyEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class TargetList(Base):
    __tablename__ = "target_lists"
    __allow_unmapped__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default=ImportStatus.PENDING)
    total_contacts = Column(Integer, default=0)
    imported_contacts = Column(Integer, default=0)
    failed_contacts = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    message_templates = relationship(
        "MessageTemplate",
        secondary=message_template_lists,
        back_populates="lists",
        lazy="noload"
    )
    
    contacts = relationship("TargetContact", back_populates="target_list", lazy="noload")
    contact_matches = relationship("ContactMatch", back_populates="target_list", lazy="noload")
