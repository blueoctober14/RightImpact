from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime
import models
from database import get_db
from sqlalchemy.orm import Session
import os
from dotenv import load_dotenv

load_dotenv()

from auth.auth import oauth2_scheme
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Strip 'Bearer ' prefix if present
        if token.lower().startswith("bearer "):
            token = token[7:]
            
        # Decode with audience validation
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], audience="RightImpact-client")
        sub = payload.get("sub")
        if sub is None:
            print("No subject in token")
            raise credentials_exception
            
        # Verify token expiration
        if datetime.fromtimestamp(payload["exp"]) < datetime.utcnow():
            print("Token has expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        # Try to find user by ID first (assuming sub is an ID if it's numeric)
        if sub.isdigit():
            user = db.query(models.User).filter(models.User.id == int(sub)).first()
            if user:
                return user
                
        # If not found by ID or sub is not numeric, try by email
        user = db.query(models.User).filter(models.User.email == sub).first()
        if user is None:
            print(f"User not found for sub: {sub}")
            raise credentials_exception
            
    except JWTError as e:
        print(f"JWT Error: {str(e)}")
        raise credentials_exception
        
    return user

async def get_current_active_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized. Admin privileges required."
        )
    return current_user
