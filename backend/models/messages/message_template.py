from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from models.base import Base
from models.associations import message_template_lists, message_template_groups

# Status values as constants for consistency
ACTIVE = 'ACTIVE'
INACTIVE = 'INACTIVE'
DRAFT = 'DRAFT'
ARCHIVED = 'ARCHIVED'

# Association table is now defined in relationships.py

class MessageTemplate(Base):
    __tablename__ = "message_templates"
    __allow_unmapped__ = True

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    message_type = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    media_url = Column(String, nullable=True)
    status = Column(String, default=INACTIVE, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user_assignments = relationship("UserMessageTemplate", back_populates="template")
    users = relationship(
        "User", 
        secondary="user_message_templates", 
        back_populates="available_templates"
    )
    
    # List relationships
    lists = relationship(
        "TargetList",
        secondary=message_template_lists,
        back_populates="message_templates"
    )
    
    # Group relationships
    groups = relationship(
        "Group",
        secondary=message_template_groups,
        back_populates="message_templates"
    )
    
    def __repr__(self):
        return f"<MessageTemplate {self.id}: {self.name} ({self.message_type})>"
