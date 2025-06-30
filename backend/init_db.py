import os
import sys

# Add the parent directory to Python path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(parent_dir)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.models import User, Contact, SharedContact, CampaignContact, Message, MessageTemplate, UserMessageTemplate

# Create all tables
engine = create_engine("sqlite:///./campaign.db", echo=True)
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

# Test the connection
with engine.connect() as conn:
    print("Database connection successful")
    print("Tables created:")
    for table in Base.metadata.tables:
        print(f"- {table}")
