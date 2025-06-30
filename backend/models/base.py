from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Table, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from sqlalchemy.sql import func

# Create the base class for all models
Base = declarative_base()

# Association table for many-to-many relationship between User and MessageTemplate
user_message_templates = Table(
    'user_message_templates',
    Base.metadata,
    Column('id', Integer, primary_key=True, index=True),
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('template_id', Integer, ForeignKey('message_templates.id')),
    Column('created_at', DateTime, default=datetime.utcnow),
)
