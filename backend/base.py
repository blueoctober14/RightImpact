from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Table, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from sqlalchemy.sql import func

# Create the base class for all models
Base = declarative_base()

# Shared models that are used across multiple modules
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    role = Column(String, default='user')  # 'user' or 'admin'
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    shared_contacts = relationship("SharedContact", back_populates="user")
    messages_sent = relationship("Message", back_populates="sender")
    available_templates = relationship("MessageTemplate", secondary="user_message_templates", back_populates="users")
    assigned_contacts = relationship("Contact", foreign_keys="Contact.assigned_to_id", back_populates="assigned_to")
