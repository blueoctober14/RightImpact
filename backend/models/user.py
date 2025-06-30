from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from models.base import Base

class User(Base):
    __tablename__ = "users"
    __allow_unmapped__ = True

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    role = Column(String, default='user')  # 'user' or 'admin'
    max_neighbor_messages = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    has_shared_contacts = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    shared_contacts = None  # This will be set up in relationships.py
    assigned_contacts = None  # This will be set up in relationships.py
    messages = None  # This will be set up in relationships.py
    
    # Many-to-many relationship with Group through UserGroup
    groups = relationship("Group", secondary="user_groups", back_populates="users", viewonly=True)
    user_groups = relationship("UserGroup", back_populates="user", cascade="all, delete-orphan")
