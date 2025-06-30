from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from models.user import User
from models.group import Group, UserGroup
from pydantic import BaseModel
from auth.auth import get_current_user, oauth2_scheme, User as AuthUser
from pydantic import Field


router = APIRouter(tags=["users"])



class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    has_shared_contacts: bool = Field(..., description="Whether user has shared contacts")
    role: str
    max_neighbor_messages: Optional[int] = None
    groups: list = []  # List of group dicts

    class Config:
        from_attributes = True

class GroupResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

from fastapi import Request
from auth.auth import get_current_user

@router.get("/me", response_model=UserResponse)
async def read_users_me(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    print(f"GET /api/users/me - Authenticated as: {current_user.email} (Role: {getattr(current_user, 'role', 'user')})")
    
    # Ensure user is attached to session
    if current_user not in db:
        current_user = db.merge(current_user)
    
    # Only update timestamps if they're None
    if current_user.created_at is None:
        current_user.created_at = datetime.utcnow()
    if current_user.updated_at is None:
        current_user.updated_at = datetime.utcnow()
    
    # Refresh to get latest data
    db.refresh(current_user)
    
    # Convert to dict and include only basic group info
    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "city": current_user.city,
        "state": current_user.state,
        "zip_code": current_user.zip_code,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "has_shared_contacts": current_user.has_shared_contacts,
        "max_neighbor_messages": current_user.max_neighbor_messages,
        "role": current_user.role,
        "groups": [{"id": g.id, "name": g.name} for g in current_user.groups] if current_user.groups else []
    }
    
    return user_dict

class CreateUserRequest(BaseModel):
    email: str
    first_name: str
    last_name: str
    password: str
    role: Optional[str] = 'user'
    is_active: Optional[bool] = True
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None

@router.post("/", response_model=UserResponse)
async def create_user(
    user: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    print(f"POST /api/users/ - Authenticated as: {current_user.email} (Role: {getattr(current_user, 'role', 'user')})")
    if not hasattr(current_user, 'role') or current_user.role != 'admin':
        print(f"Access denied: User {current_user.email} is not an admin")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    # Check if email already exists
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    # Hash password
    from auth.auth import get_password_hash
    hashed_pw = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        password_hash=hashed_pw,
        role=user.role,
        city=user.city,
        state=user.state,
        zip_code=user.zip_code
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    # Invalidate users list cache
    await delete_pattern('users:list:*')
    return db_user

from fastapi.encoders import jsonable_encoder
import json
from utils.cache import redis_cache, delete_pattern  # Adjust import if your Redis instance is elsewhere

@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: Optional[int] = 0, 
    limit: Optional[int] = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    from datetime import datetime
    start_time = datetime.now()
    print("\n=== GET /api/users/ ===")
    print(f"Authenticated as user: {current_user.email} (Role: {getattr(current_user, 'role', 'user')})")
    
    # Check if user is admin
    if not hasattr(current_user, 'role') or current_user.role != 'admin':
        print(f"Access denied: User {current_user.email} is not an admin")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    # Redis cache key includes skip, limit, and admin user id
    cache_key = f"users:list:skip={skip}:limit={limit}:admin={current_user.id}"
    cached = await redis_cache.get(cache_key)
    if cached:
        print("Cache hit for users list")
        end_time = datetime.now()
        elapsed_ms = (end_time - start_time).total_seconds() * 1000
        print(f"[TIMING] GET /api/users/ (cache hit): {elapsed_ms:.2f} ms")
        return json.loads(cached)

    # Raw SQL query for users (no relationships)
    from sqlalchemy import text
    user_sql = """
        SELECT id, email, first_name, last_name, city, state, zip_code, 
               created_at, updated_at, has_shared_contacts, role, max_neighbor_messages
        FROM users
        ORDER BY id
        LIMIT :limit OFFSET :offset
    """
    result = db.execute(text(user_sql), {"limit": limit, "offset": skip})
    users = result.fetchall()
    print(f"Found {len(users)} users in database")

    user_ids = [row[0] for row in users]
    groups_map = {uid: [] for uid in user_ids}
    if user_ids:
        # Batch fetch user groups
        # Dynamically create the correct number of placeholders for SQLite
        # Dynamically create named placeholders and param dict for SQLite compatibility
        placeholders = ','.join([f":id{i}" for i in range(len(user_ids))])
        group_sql = f"""
            SELECT ug.user_id, g.id, g.name
            FROM user_groups ug
            JOIN groups g ON ug.group_id = g.id
            WHERE ug.user_id IN ({placeholders})
        """
        param_dict = {f"id{i}": uid for i, uid in enumerate(user_ids)}
        from sqlalchemy import text as sa_text
        group_result = db.execute(sa_text(group_sql), param_dict)
        for user_id, group_id, group_name in group_result.fetchall():
            groups_map[user_id].append({"id": group_id, "name": group_name})

    user_responses = []
    for i, row in enumerate(users, 1):
        print(f"User {i}: ID={row[0]}, Email={row[1]}, Name={row[2]} {row[3]} (Role: {row[10]})")
        user_responses.append({
            "id": row[0],
            "email": row[1],
            "first_name": row[2],
            "last_name": row[3],
            "city": row[4],
            "state": row[5],
            "zip_code": row[6],
            "created_at": row[7],
            "updated_at": row[8],
            "has_shared_contacts": bool(row[9]),
            "role": row[10] or 'user',
            "max_neighbor_messages": row[11],
            "groups": groups_map.get(row[0], [])
        })
    db.commit()
    # Cache the result for 30 seconds
    await redis_cache.set(cache_key, json.dumps(jsonable_encoder(user_responses)), ex=30)
    print("Cached users list in Redis")
    end_time = datetime.now()
    elapsed_ms = (end_time - start_time).total_seconds() * 1000
    print(f"[TIMING] GET /api/users/: {elapsed_ms:.2f} ms")
    return user_responses

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    print(f"GET /api/users/{user_id} - Authenticated as: {current_user.email} (Role: {getattr(current_user, 'role', 'user')})")
    
    # Check if user is admin
    if not hasattr(current_user, 'role') or current_user.role != 'admin':
        print(f"Access denied: User {current_user.email} is not an admin")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    update_data: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    print(f"PUT /api/users/{user_id} - Authenticated as: {current_user.email} (Role: {getattr(current_user, 'role', 'user')})")
    if not hasattr(current_user, 'role') or current_user.role != 'admin':
        print(f"Access denied: User {current_user.email} is not an admin")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    print(f"Incoming update payload: {update_data}")
    print(f"User before update: has_shared_contacts={user.has_shared_contacts}")
    # Update fields if present
    for field in ["first_name", "last_name", "email", "role", "is_active", "city", "state", "zip_code", "has_shared_contacts", "max_neighbor_messages"]:
        if field in update_data:
            value = update_data[field]
            if field == "has_shared_contacts":
                value = bool(value)
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    print(f"User after update: has_shared_contacts={user.has_shared_contacts}")
    # Invalidate users list cache
    await delete_pattern('users:list:*')
    # Serialize groups as list of dicts
    groups = [
        {"id": g.id, "name": g.name} for g in getattr(user, 'groups', [])
    ]
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "city": user.city,
        "state": user.state,
        "zip_code": user.zip_code,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "has_shared_contacts": user.has_shared_contacts,
        "role": user.role,
        "max_neighbor_messages": user.max_neighbor_messages,
        "groups": groups
    }

@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    print(f"DELETE /api/users/{user_id} - Authenticated as: {current_user.email} (Role: {getattr(current_user, 'role', 'user')})")
    
    # Check if user is admin with consistent error handling
    if not hasattr(current_user, 'role') or current_user.role != 'admin':
        print(f"Access denied: User {current_user.email} is not an admin")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting the last admin user
    if user.role == 'admin':
        admin_count = db.query(User).filter(User.role == 'admin').count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last admin user"
            )
    
    db.delete(user)
    db.commit()
    # Invalidate users list cache
    await delete_pattern('users:list:*')
    return {"ok": True}

@router.get("/{user_id}/groups", response_model=List[GroupResponse])
def get_user_groups(user_id: int, db: Session = Depends(get_db)):
    try:
        # Get the user with their user_groups and the related group
        from sqlalchemy.orm import joinedload
        import time
        
        start_time = time.time()
        user = db.query(User).options(
            joinedload(User.user_groups).joinedload(UserGroup.group)
        ).filter(User.id == user_id).first()
        query_time = time.time() - start_time
        
        if query_time > 1.0:
            print(f"SLOW QUERY: get_user_groups for user_id={user_id} took {query_time:.2f} seconds")
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Extract the groups from the user_groups relationship
        groups = [user_group.group for user_group in user.user_groups]
        return groups
        
    except Exception as e:
        print(f"Error getting user groups: {str(e)}")
        import traceback
        traceback.print_exc()


@router.get("/batch/groups")
async def get_multiple_users_groups(request: Request, db: Session = Depends(get_db)):
    """
    Get groups for multiple users at once.
    user_ids should be a comma-separated string of user IDs in the query parameter.
    Returns a dictionary mapping user_id -> list of groups.
    """
    try:
        import time
        start_time = time.time()
        
        # Get user_ids from query parameters
        user_ids = request.query_params.get('user_ids', '')
        print(f"Batch groups request with user_ids: {user_ids}")
        
        # Parse the user_ids parameter
        try:
            user_id_list = [int(uid.strip()) for uid in user_ids.split(',') if uid.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_ids format. Expected comma-separated integers.")
        
        if not user_id_list:
            return {}
            
        # Get all users with their groups in a single query
        from sqlalchemy.orm import joinedload
        users = db.query(User).options(
            joinedload(User.user_groups).joinedload(UserGroup.group)
        ).filter(User.id.in_(user_id_list)).all()
        
        # Build the response dictionary with JSON-serializable group info
        result = {}
        for user in users:
            result[user.id] = [
                {
                    "id": user_group.group.id,
                    "name": user_group.group.name,
                    "description": user_group.group.description
                }
                for user_group in user.user_groups if user_group.group is not None
            ]
        # Add empty arrays for requested users that weren't found
        for user_id in user_id_list:
            if user_id not in result:
                result[user_id] = []
        query_time = time.time() - start_time
        if query_time > 1.0:
            print(f"SLOW QUERY: get_multiple_users_groups for {len(user_id_list)} users took {query_time:.2f} seconds")
        return result
        
    except Exception as e:
        print(f"Error getting multiple users groups: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching user groups: {str(e)}")

@router.post("/{user_id}/groups/{group_id}")
def add_user_to_group(user_id: int, group_id: int, db: Session = Depends(get_db)):
    try:
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if group exists
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Check if association already exists
        existing = db.query(UserGroup).filter(
            UserGroup.user_id == user_id,
            UserGroup.group_id == group_id
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="User already in group")
        
        # Create new association
        user_group = UserGroup(user_id=user_id, group_id=group_id)
        db.add(user_group)
        db.commit()
        
        # Refresh the user to get updated groups
        db.refresh(user)
        
        return {
            "message": "User added to group successfully",
            "user_id": user_id,
            "group_id": group_id
        }
    except Exception as e:
        db.rollback()
        print(f"Error adding user to group: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{user_id}/groups/{group_id}")
def remove_user_from_group(user_id: int, group_id: int, db: Session = Depends(get_db)):
    try:
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if group exists
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Find and delete the association
        user_group = db.query(UserGroup).filter(
            UserGroup.user_id == user_id,
            UserGroup.group_id == group_id
        ).first()
        
        if not user_group:
            raise HTTPException(status_code=404, detail="User is not in the specified group")
        
        db.delete(user_group)
        db.commit()
        
        # Refresh the user to update the groups relationship
        db.refresh(user)
        
        return {
            "message": "User removed from group successfully",
            "user_id": user_id,
            "group_id": group_id
        }
    except Exception as e:
        db.rollback()
        print(f"Error removing user from group: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
