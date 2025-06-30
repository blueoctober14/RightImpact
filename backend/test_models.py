import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.base import Base
from models.user import User
from models.targets.target_list import TargetList
from models.targets.target_contact import TargetContact
from models.shared_contact import SharedContact
from models.contact_match import ContactMatch
from database import SQLALCHEMY_DATABASE_URL

def test_models():
    # Create a new SQLite database in memory for testing
    engine = create_engine('sqlite:///:memory:', echo=True)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Create all tables
    Base.metadata.create_all(engine)
    
    try:
        # Create a test user
        user = User(
            email="test@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User"
        )
        session.add(user)
        session.commit()
        
        # Create a target list
        target_list = TargetList(
            name="Test Target List",
            description="A test target list"
        )
        session.add(target_list)
        session.commit()
        
        # Create a target contact
        target_contact = TargetContact(
            target_list_id=target_list.id,
            first_name="John",
            last_name="Doe",
            phone1="+1234567890",
            email="john.doe@example.com"
        )
        session.add(target_contact)
        session.commit()
        
        # Create a shared contact
        shared_contact = SharedContact(
            user_id=user.id,
            first_name="John",
            last_name="Doe",
            phone_number="+1234567890",
            email="john.doe@example.com"
        )
        session.add(shared_contact)
        session.commit()
        
        # Create a contact match
        contact_match = ContactMatch(
            shared_contact_id=shared_contact.id,
            target_contact_id=target_contact.id,
            target_list_id=target_list.id,
            match_confidence="high"
        )
        session.add(contact_match)
        session.commit()
        
        # Query the data
        print("\n--- Target Lists ---")
        for tl in session.query(TargetList).all():
            print(f"ID: {tl.id}, Name: {tl.name}, Description: {tl.description}")
        
        print("\n--- Target Contacts ---")
        for tc in session.query(TargetContact).all():
            print(f"ID: {tc.id}, Name: {tc.first_name} {tc.last_name}, Email: {tc.email}")
        
        print("\n--- Shared Contacts ---")
        for sc in session.query(SharedContact).all():
            print(f"ID: {sc.id}, Name: {sc.first_name} {sc.last_name}, Phone: {sc.phone_number}")
        
        print("\n--- Contact Matches ---")
        for cm in session.query(ContactMatch).all():
            print(f"Match ID: {cm.id}, Shared Contact ID: {cm.shared_contact_id}, Target Contact ID: {cm.target_contact_id}")
        
        print("\nAll tests passed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    test_models()
