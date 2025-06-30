from sqlalchemy import Column, Integer, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime

from models.base import Base

class UserMessageTemplate(Base):
    __tablename__ = "user_message_templates"
    __allow_unmapped__ = True
    
    id = Column(Integer, primary_key=True)  
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("message_templates.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Add a unique constraint on user_id and template_id
    __table_args__ = (
        Index('idx_user_template', 'user_id', 'template_id', unique=True),
        {'extend_existing': True}
    )
    
    # Relationships
    user = relationship("User", back_populates="user_templates")
    template = relationship("MessageTemplate", back_populates="user_assignments")
    
    # No need for the template_id property as it's already defined as a Column
    # The property was causing infinite recursion
