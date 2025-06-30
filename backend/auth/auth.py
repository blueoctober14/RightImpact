from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Header
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import os
import json
import time
import logging
from dotenv import load_dotenv
import bcrypt
from utils.cache import redis_cache

# Configure logging
logger = logging.getLogger(__name__)

# Import models from their respective modules to avoid circular imports
from models.base import Base
from models.user import User
from models.contact import Contact
from models.shared_contact import SharedContact
from models.messages.message import Message
from models.contact_match import ContactMatch
from models.contacts.campaign_contact import CampaignContact
from models.messages.message_template import MessageTemplate
from models.messages.user_message_template import UserMessageTemplate
from database import get_db

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["auth"])
# This is just for Swagger UI - the actual URL is handled by FastAPI's routing
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# --- Add global exception handler for validation errors ---
from fastapi import APIRouter
from fastapi.requests import Request as FastAPIRequest
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import RequestValidationError
from fastapi.exceptions import RequestValidationError as FastAPIRequestValidationError

app = None
try:
    import main
    app = main.app
except Exception:
    pass

if app is not None:
    @app.exception_handler(FastAPIRequestValidationError)
    async def validation_exception_handler(request: FastAPIRequest, exc: FastAPIRequestValidationError):
        print(f"VALIDATION ERROR: {exc.errors()}")
        return JSONResponse(
            status_code=422,
            content={"detail": exc.errors(), "body": exc.body},
        )

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
# Set token expiration to 30 days (60 minutes * 24 hours * 30 days)
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 43,200 minutes = 30 days

class UserCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    city: str
    state: str
    zip_code: str

class UserInToken(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role: str
    isAdmin: bool = False

class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    role: str = 'user'
    isAdmin: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    has_shared_contacts: bool = False
    max_neighbor_messages: Optional[int] = None
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserInToken] = None

def get_password_hash(password):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password, hashed_password):
    try:
        # Add more detailed logging for debugging
        print(f"Verifying password: length={len(plain_password)}, hash_length={len(hashed_password) if hashed_password else 'None'}, hash_type={type(hashed_password)}")
        
        # Ensure we have valid inputs
        if not plain_password or not hashed_password:
            print("Missing password or hash")
            return False
            
        # bcrypt.checkpw expects the hashed password as bytes
        plain_bytes = plain_password.encode('utf-8')
        
        # Handle different hash formats
        if isinstance(hashed_password, str):
            # Remove any whitespace that might have been introduced
            hashed_password = hashed_password.strip()
            hash_bytes = hashed_password.encode('utf-8')
        else:
            hash_bytes = hashed_password
            
        # Verify the password
        result = bcrypt.checkpw(plain_bytes, hash_bytes)
        print(f"Password verification result: {result}")
        return result
    except Exception as e:
        print(f"Password verification error: {e}")
        return False

async def get_user(db: Session, email: str):
    """
    Get a user by email from the database with Redis caching.
    
    Args:
        db: Database session
        email: Email address to look up
        
    Returns:
        User object if found, None otherwise
    """
    start_time = time.time()
    try:
        email_lower = email.lower()
        
        # Try to get from cache first
        cache_key = f"user:email:{email_lower}"
        cached_user = await redis_cache.get(cache_key)
        
        if cached_user:
            # User found in cache
            logger.info(f"User cache hit for email: {email_lower}")
            user_dict = json.loads(cached_user)
            
            # Reconstruct User object from cache
            user = User(
                id=user_dict["id"],
                email=user_dict["email"],
                password_hash=user_dict["password_hash"],
                first_name=user_dict.get("first_name"),
                last_name=user_dict.get("last_name"),
                role=user_dict.get("role", "user"),
                city=user_dict.get("city"),
                state=user_dict.get("state"),
                zip_code=user_dict.get("zip_code"),
                has_shared_contacts=user_dict.get("has_shared_contacts"),
                max_neighbor_messages=user_dict.get("max_neighbor_messages")
            )
            elapsed = (time.time() - start_time) * 1000
            logger.info(f"User retrieved from cache in {elapsed:.2f}ms")
            return user
        
        # Not in cache, query database
        logger.info(f"User cache miss for email: {email_lower}")
        db_query_start = time.time()
        
        # Try exact match first (indexed query)
        user = db.query(User).filter(User.email == email_lower).first()
        
        # If not found, try case-insensitive search
        if not user:
            user = db.query(User).filter(User.email.ilike(f"%{email_lower}%")).first()
        
        db_query_time = (time.time() - db_query_start) * 1000
        logger.info(f"Database query for user took {db_query_time:.2f}ms")
        
        if user:
            # Cache the user for future requests (30 minutes)
            user_dict = {
                "id": user.id,
                "email": user.email,
                "password_hash": user.password_hash,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "city": user.city,
                "state": user.state,
                "zip_code": user.zip_code,
                "has_shared_contacts": user.has_shared_contacts,
                "max_neighbor_messages": user.max_neighbor_messages
            }
            await redis_cache.set(cache_key, json.dumps(user_dict), ex=1800)  # 30 minutes
            
            # Also cache by ID for token validation
            id_cache_key = f"user:id:{user.id}"
            await redis_cache.set(id_cache_key, json.dumps(user_dict), ex=1800)  # 30 minutes
        
        elapsed = (time.time() - start_time) * 1000
        logger.info(f"User lookup completed in {elapsed:.2f}ms")
        return user
    except Exception as e:
        elapsed = (time.time() - start_time) * 1000
        logger.error(f"Error in get_user ({elapsed:.2f}ms): {e}")
        return None

async def authenticate_user(db: Session, email: str, password: str):
    """Authenticate a user with Redis caching for performance"""
    start_time = time.time()
    logger.info(f"Authenticating user: {email}")
    
    # Get user from cache or database
    user = await get_user(db, email)
    if not user:
        logger.warning(f"No user found for email: {email}")
        return False
    
    # Verify password
    pw_verify_start = time.time()
    if not verify_password(password, user.password_hash):
        pw_verify_time = (time.time() - pw_verify_start) * 1000
        logger.warning(f"Password verification failed for user: {email} (took {pw_verify_time:.2f}ms)")
        return False
    
    pw_verify_time = (time.time() - pw_verify_start) * 1000
    total_time = (time.time() - start_time) * 1000
    
    # Log performance metrics
    logger.info(f"Password verification took {pw_verify_time:.2f}ms")
    logger.info(f"Authentication successful for user: {email} (total: {total_time:.2f}ms)")
    
    return user

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Validate JWT token and return current user with Redis caching"""
    start_time = time.time()
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Strip any 'Bearer ' prefix if present
        if token.lower().startswith("bearer "):
            token = token[7:]
        
        # Try to get from token cache first
        token_cache_key = f"token:{token[:64]}"  # Use first 64 chars of token as key
        cached_user_id = await redis_cache.get(token_cache_key)
        
        if cached_user_id:
            # Token is valid, get user from cache
            user_id = cached_user_id
            logger.info(f"Token cache hit for user ID: {user_id}")
            
            # Try to get user from cache
            user_cache_key = f"user:id:{user_id}"
            cached_user = await redis_cache.get(user_cache_key)
            
            if cached_user:
                # User found in cache
                user_dict = json.loads(cached_user)
                
                # Reconstruct User object
                user = User(
                    id=user_dict["id"],
                    email=user_dict["email"],
                    password_hash=user_dict["password_hash"],
                    first_name=user_dict.get("first_name"),
                    last_name=user_dict.get("last_name"),
                    role=user_dict.get("role", "user"),
                    city=user_dict.get("city"),
                    state=user_dict.get("state"),
                    zip_code=user_dict.get("zip_code"),
                    has_shared_contacts=user_dict.get("has_shared_contacts"),
                    max_neighbor_messages=user_dict.get("max_neighbor_messages")
                )
                
                elapsed = (time.time() - start_time) * 1000
                logger.info(f"Token validation completed from cache in {elapsed:.2f}ms")
                return user
        
        # Not in cache, decode and validate token
        logger.info("Token cache miss, validating JWT")
        jwt_start_time = time.time()
        
        # Decode the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], audience="RightImpact-client")
        user_id = payload.get("sub")
        if not user_id:
            logger.warning("No user ID in token")
            raise credentials_exception
        
        jwt_time = (time.time() - jwt_start_time) * 1000
        logger.info(f"JWT decode took {jwt_time:.2f}ms")
        
        # Cache the token->user_id mapping (expires with token)
        token_exp = payload.get("exp")
        if token_exp:
            # Calculate seconds until expiration
            now = int(time.time())
            ttl = max(0, token_exp - now)  # Don't use negative TTL
            await redis_cache.set(token_cache_key, user_id, ex=ttl)
        
        # Get user from database by ID
        db_start_time = time.time()
        user = db.query(User).filter(User.id == int(user_id)).first()
        db_time = (time.time() - db_start_time) * 1000
        
        if user is None:
            logger.warning(f"User not found for ID: {user_id}")
            raise credentials_exception
        
        # Cache the user for future requests
        user_dict = {
            "id": user.id,
            "email": user.email,
            "password_hash": user.password_hash,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "city": user.city,
            "state": user.state,
            "zip_code": user.zip_code,
            "has_shared_contacts": user.has_shared_contacts,
            "max_neighbor_messages": user.max_neighbor_messages
        }
        
        user_cache_key = f"user:id:{user.id}"
        await redis_cache.set(user_cache_key, json.dumps(user_dict), ex=1800)  # 30 minutes
        
        elapsed = (time.time() - start_time) * 1000
        logger.info(f"Token validation completed in {elapsed:.2f}ms (DB: {db_time:.2f}ms)")
        return user
        
    except JWTError as e:
        logger.error(f"JWT Error: {str(e)}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {str(e)}")
        raise credentials_exception


def get_admin_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Dependency to check if the current user is an admin.
    Raises 403 if the user is not an admin.
    """
    if not current_user or current_user.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Create a JWT token with the given data and expiration.
    
    Args:
        data: Dictionary containing the token claims (must include 'sub' for subject)
        expires_delta: Optional timedelta for token expiration
    """
    start_time = time.time()
    to_encode = data.copy()
    
    # Set expiration time
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Add required claims
    to_encode.update({
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "iss": "RightImpact-backend",
        "aud": "RightImpact-client"
    })
    
    # Ensure required claims exist
    if "sub" not in to_encode:
        raise ValueError("Token data must include 'sub' (subject) claim")
    
    try:
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        elapsed = (time.time() - start_time) * 1000
        logger.info(f"JWT token created in {elapsed:.2f}ms")
        return encoded_jwt
    except Exception as e:
        elapsed = (time.time() - start_time) * 1000
        logger.error(f"Error encoding JWT ({elapsed:.2f}ms): {str(e)}")
        raise

@router.post("/register", response_model=Token)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user with performance tracking"""
    start_time = time.time()
    logger.info(f"Registration attempt for: {user.email}")
    
    # Check if user already exists
    db_user = await get_user(db, user.email)
    if db_user:
        logger.warning(f"Registration failed - email already exists: {user.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    try:
        # Hash password
        hash_start = time.time()
        hashed_password = get_password_hash(user.password)
        hash_time = (time.time() - hash_start) * 1000
        logger.info(f"Password hashing took {hash_time:.2f}ms")
        
        # Create user object
        db_user = User(
            email=user.email.lower(),  # Store email in lowercase for consistency
            password_hash=hashed_password,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role or "user"
        )
        
        # Save to database
        db_start = time.time()
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        db_time = (time.time() - db_start) * 1000
        logger.info(f"Database operations took {db_time:.2f}ms")
        
        # Cache the new user
        cache_start = time.time()
        user_dict = {
            "id": db_user.id,
            "email": db_user.email,
            "password_hash": db_user.password_hash,
            "first_name": db_user.first_name,
            "last_name": db_user.last_name,
            "role": db_user.role,
            "city": db_user.city,
            "state": db_user.state,
            "zip_code": db_user.zip_code,
            "has_shared_contacts": db_user.has_shared_contacts,
            "max_neighbor_messages": db_user.max_neighbor_messages
        }
        
        # Cache by email and ID
        email_cache_key = f"user:email:{db_user.email.lower()}"
        id_cache_key = f"user:id:{db_user.id}"
        await redis_cache.set(email_cache_key, json.dumps(user_dict), ex=1800)  # 30 minutes
        await redis_cache.set(id_cache_key, json.dumps(user_dict), ex=1800)  # 30 minutes
        cache_time = (time.time() - cache_start) * 1000
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(db_user.id)}, expires_delta=access_token_expires
        )
        
        # Cache the token
        token_cache_key = f"token:{access_token[:64]}"  # Use first 64 chars of token as key
        await redis_cache.set(token_cache_key, str(db_user.id), ex=ACCESS_TOKEN_EXPIRE_MINUTES * 60)
        
        # Log performance metrics
        total_time = (time.time() - start_time) * 1000
        logger.info(f"User registration successful: {db_user.email} (ID: {db_user.id})")
        logger.info(f"Registration process took {total_time:.2f}ms (DB: {db_time:.2f}ms, Cache: {cache_time:.2f}ms)")
        
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "user": {
                "id": db_user.id,
                "email": db_user.email,
                "first_name": db_user.first_name,
                "last_name": db_user.last_name,
                "role": db_user.role,
                "isAdmin": db_user.role.lower() == 'admin'
            }
        }
    except Exception as e:
        elapsed = (time.time() - start_time) * 1000
        logger.error(f"Registration error ({elapsed:.2f}ms): {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

from fastapi import Request, FastAPI
from fastapi.exception_handlers import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError as FastAPIRequestValidationError

@router.post("/token", response_model=Token, include_in_schema=True, tags=["auth"])
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login endpoint with performance optimizations and Redis caching"""
    start_time = time.time()
    logger.info(f"Login attempt for user: {form_data.username}")
    
    try:
        # Authenticate user with Redis caching
        user = await authenticate_user(db, form_data.username, form_data.password)
        if not user:
            logger.warning(f"Authentication failed for user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Ensure user has a role
        role = getattr(user, 'role', 'user')
        if not role:
            logger.info(f"User has no role, setting default role: user")
            role = 'user'
            user.role = role
            db.add(user)
            db.commit()
        
        # Create access token with user ID as sub
        token_start = time.time()
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )
        token_time = (time.time() - token_start) * 1000
        
        # Cache the token->user_id mapping
        token_cache_key = f"token:{access_token[:64]}"  # Use first 64 chars of token as key
        await redis_cache.set(token_cache_key, str(user.id), ex=ACCESS_TOKEN_EXPIRE_MINUTES * 60)
        
        # Prepare response
        response = {
            "access_token": access_token, 
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": role,
                "isAdmin": role.lower() == 'admin'  # Case-insensitive check
            }
        }
        
        # Log performance metrics
        total_time = (time.time() - start_time) * 1000
        logger.info(f"Login successful for user: {user.email} (ID: {user.id}, Role: {role})")
        logger.info(f"Token generation took {token_time:.2f}ms")
        logger.info(f"Total login process took {total_time:.2f}ms")
        
        return response
        
    except HTTPException:
        elapsed = (time.time() - start_time) * 1000
        logger.warning(f"Login failed with HTTP exception in {elapsed:.2f}ms")
        raise
    except Exception as e:
        elapsed = (time.time() - start_time) * 1000
        logger.error(f"Unexpected error during login ({elapsed:.2f}ms): {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login"
        )

@router.get("/me", response_model=UserResponse)
async def read_users_me(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    current_user = await get_current_user(token, db)
    logger.info(f"[DEBUG] User has_shared_contacts value: {current_user.has_shared_contacts} (type: {type(current_user.has_shared_contacts)})")
    # Ensure we return a UserResponse, not the raw SQLAlchemy model
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        city=current_user.city,
        state=current_user.state,
        zip_code=current_user.zip_code,
        role=current_user.role,
        isAdmin=getattr(current_user, 'role', 'user') == 'admin',
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        has_shared_contacts=current_user.has_shared_contacts is True or getattr(current_user, 'has_shared_contacts', 0) == 1,
        max_neighbor_messages=current_user.max_neighbor_messages
    )

def get_token_from_header(authorization: str = None) -> str:
    """Extract token from Authorization header, with or without Bearer prefix."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authorization header provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Handle both "Bearer <token>" and raw token
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    # If no Bearer prefix, assume the whole string is the token
    return authorization

@router.get("/manual-decode")
async def manual_decode(token: str):
    from jose import jwt
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], audience="RightImpact-client")
        print("Manual decode payload:", payload)
        return {"payload": payload}
    except Exception as e:
        print("Manual decode error:", str(e))
        return {"error": str(e)}


@router.get("/debug-headers")
async def debug_headers(request: Request):
    print("\n=== DEBUG HEADERS ===")
    headers = dict(request.headers)
    for k, v in headers.items():
        print(f"{k}: {v}")
    return {"headers": headers}


@router.get("/verify-token")
async def verify_token(
    request: Request,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    print("\n=== GET /api/auth/verify-token ===")
    print(f"Request headers: {dict(request.headers)}")
    print(f"Raw token from oauth2_scheme: {token}")
    
    # Check if token is missing due to CORS/credentials issues
    auth_header = request.headers.get("authorization")
    print(f"Authorization header: {auth_header}")
    
    # If token is missing but auth header exists, extract from header
    if not token and auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
        print(f"Extracted token from Authorization header: {token[:20]}...")
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Defensive: strip Bearer if present (shouldn't be, but just in case)
        if token.lower().startswith("bearer "):
            token = token[7:]
            print("Stripped 'Bearer ' prefix from token.")
        print(f"Token to decode (first 20 chars): {token[:20]}...")
        
        # Decode the JWT token
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], audience="RightImpact-client")
            print(f"Decoded token payload: {payload}")
        except JWTError as e:
            print(f"JWT decode error: {str(e)}")
            raise credentials_exception
            
        user_id = payload.get("sub")
        if not user_id:
            print("No user ID in token")
            raise credentials_exception
            
        try:
            # Get user from database by ID
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user is None:
                print(f"User not found for ID: {user_id}")
                raise credentials_exception
                
            # Verify token expiration
            if datetime.fromtimestamp(payload["exp"]) < datetime.utcnow():
                print("Token has expired")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired",
                    headers={"WWW-Authenticate": "Bearer"},
                )
                
            role = getattr(user, 'role', 'user')
            print(f"Token verified for user: {user.email} (ID: {user.id}, Role: {role})")
            
            # Return user data with role information
            response_data = {
                "valid": True,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": role,
                    "isAdmin": role.lower() == 'admin'
                }
            }
            print(f"Returning successful verification response: {response_data}")
            return response_data
            
        except Exception as e:
            print(f"Database or user error: {str(e)}")
            raise credentials_exception
    except Exception as e:
        print(f"Unexpected error in verify-token: {str(e)}")
        raise credentials_exception
            
# Add a custom token verification endpoint that doesn't rely on OAuth2 scheme
@router.get("/verify-token-custom")
async def verify_token_custom(
    request: Request,
    db: Session = Depends(get_db)
):
    print("\n=== GET /api/auth/verify-token-custom ===")
    print(f"Request headers: {dict(request.headers)}")
    
    # Extract token from Authorization header
    auth_header = request.headers.get("authorization")
    print(f"Authorization header: {auth_header}")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        print("No valid Authorization header found")
        return {"valid": False, "message": "No valid Authorization header found"}
    
    # Extract token
    token = auth_header.replace("Bearer ", "")
    print(f"Extracted token: {token[:20]}...")
    
    try:
        # Decode the JWT token
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], audience="RightImpact-client")
            print(f"Decoded token payload: {payload}")
        except JWTError as e:
            print(f"JWT decode error: {str(e)}")
            return {"valid": False, "message": "Invalid token format"}
        
        # Extract user ID from token
        user_id = payload.get("sub")
        if not user_id:
            print("No user ID in token")
            return {"valid": False, "message": "No user ID in token"}
        
        # Get user from database by ID
        try:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user is None:
                print(f"User not found for ID: {user_id}")
                return {"valid": False, "message": "User not found"}
            
            # Verify token expiration
            if datetime.fromtimestamp(payload["exp"]) < datetime.utcnow():
                print("Token has expired")
                return {"valid": False, "message": "Token has expired"}
            
            # User found and token valid
            role = getattr(user, 'role', 'user')
            print(f"Token verified for user: {user.email} (ID: {user.id}, Role: {role})")
            
            # Return user data with role information
            response_data = {
                "valid": True,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": role,
                    "isAdmin": role.lower() == 'admin'
                }
            }
            print(f"Returning successful verification response: {response_data}")
            return response_data
            
        except Exception as e:
            print(f"Database or user error: {str(e)}")
            return {"valid": False, "message": f"Database error: {str(e)}"}
            
    except HTTPException as he:
        print(f"HTTP Exception in verify-token: {he.detail}")
        raise he
    except Exception as e:
        print(f"Unexpected error in verify-token-custom: {str(e)}")
        return {"valid": False, "message": f"Unexpected error: {str(e)}"}

@router.get("/test-auth")
async def test_auth(current_user: User = Depends(get_current_user)):
    """
    Test endpoint to verify authentication is working correctly.
    Returns basic user info if authentication succeeds.
    """
    return {
        "status": "success",
        "user_id": current_user.id,
        "email": current_user.email,
        "message": "Authentication successful"
    }
