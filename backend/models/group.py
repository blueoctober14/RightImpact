from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from models.base import Base
from models.user import User  # Import User model here

class Group(Base):
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with users through the association table
    users = relationship("User", secondary="user_groups", back_populates="groups", viewonly=True)
    user_groups = relationship("UserGroup", back_populates="group", cascade="all, delete-orphan")
    
    # Relationship with message templates
    message_templates = relationship(
        "MessageTemplate",
        secondary="message_template_groups",
        back_populates="groups"
    )

class UserGroup(Base):
    __tablename__ = "user_groups"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Add relationship to easily access group and user objects
    user = relationship("User", back_populates="user_groups")
    group = relationship("Group", back_populates="user_groups")
    
    # Add a unique constraint on the combination of user_id and group_id
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )
