import sys
import os
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Add the parent directory to the path so we can import our models
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models.base import Base
from models.user import User
from database import get_db

# Load environment variables
load_dotenv()

# Database connection URL
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_URL = f"sqlite:///{os.path.join(current_dir, 'campaign.db')}"

def update_admin_role(email: str):
    # Create database engine
    engine = create_engine(DATABASE_URL)
    
    # Create a new session
    db = Session(engine)
    
    try:
        # Find the user by email
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            print(f"Error: User with email {email} not found")
            return False
            
        # Update the user's role to admin
        user.role = 'admin'
        db.commit()
        print(f"Successfully updated {email} to admin role")
        return True
        
    except Exception as e:
        print(f"Error updating user role: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.update_admin_role <email>")
        sys.exit(1)
        
    email = sys.argv[1]
    update_admin_role(email)
