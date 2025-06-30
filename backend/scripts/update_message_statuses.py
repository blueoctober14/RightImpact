"""Script to update message status values to uppercase."""
import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the parent directory to the path so we can import our models
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import SQLALCHEMY_DATABASE_URL

def update_message_statuses():
    """Update all message statuses to uppercase."""
    # Create a new engine and session
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # First, update all 'active' to 'ACTIVE'
        session.execute(
            text("UPDATE message_templates SET status = 'ACTIVE' WHERE status = 'active'")
        )
        
        # Then update all 'inactive' to 'INACTIVE'
        session.execute(
            text("UPDATE message_templates SET status = 'INACTIVE' WHERE status = 'inactive'")
        )
        
        # Commit the changes
        session.commit()
        print("Successfully updated message statuses to uppercase")
        
    except Exception as e:
        session.rollback()
        print(f"Error updating message statuses: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    update_message_statuses()
