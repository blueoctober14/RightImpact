from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime
import logging

from database import get_db
from models.group import Group, UserGroup
from models.user import User
from pydantic import BaseModel

# Import UserResponse from users routes
from users.routes import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["groups"])

class GroupCreate(BaseModel):
    name: str

class GroupResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Handle both /groups and /groups/ for all methods

from sqlalchemy import func

@router.get("/user_counts")
def get_all_group_user_counts(db: Session = Depends(get_db)):
    """
    Return user counts for all groups as a list of {group_id, user_count}.
    """
    results = db.query(UserGroup.group_id, func.count(UserGroup.user_id)).group_by(UserGroup.group_id).all()
    return [{"group_id": gid, "user_count": count} for gid, count in results]

from fastapi.encoders import jsonable_encoder
import json
from utils.cache import redis_cache, delete_pattern

@router.api_route("", methods=["GET"], response_model=List[GroupResponse])
@router.api_route("/", methods=["GET"], response_model=List[GroupResponse])
async def get_groups(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    logger.info(f"GET /groups - Headers: {request.headers}")
    logger.info(f"GET /groups - Query Params: {request.query_params}")
    cache_key = f"groups_list_{skip}_{limit}"
    cached = await redis_cache.get(cache_key)
    if cached:
        logger.info("Returning cached groups list from Redis")
        return json.loads(cached)
    groups = db.query(Group).offset(skip).limit(limit).all()
    group_responses = []
    for group in groups:
        group_responses.append({
            "id": group.id,
            "name": group.name,
            "created_at": group.created_at,
            "updated_at": group.updated_at
        })
    await redis_cache.set(cache_key, json.dumps(jsonable_encoder(group_responses)), ex=30)
    logger.info("Cached groups list in Redis")
    return group_responses

@router.api_route("", methods=["POST"], response_model=GroupResponse, status_code=201)
@router.api_route("/", methods=["POST"], response_model=GroupResponse, status_code=201)
async def create_group(
    request: Request,
    group: GroupCreate,
    db: Session = Depends(get_db)
):
    logger.info(f"POST /groups - Headers: {request.headers}")
    logger.info(f"POST /groups - Request body: {group.dict()}")
    logger.info(f"Available routes: {request.app.routes}")
    
    # Log all registered routes for debugging
    for route in request.app.routes:
        logger.info(f"Route: {route.path} - Methods: {getattr(route, 'methods', 'N/A')}")
    db_group = Group(name=group.name)
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    # Invalidate groups list cache
    await delete_pattern('groups_list*')
    return db_group

@router.api_route("/{group_id}", methods=["DELETE"])
@router.api_route("/{group_id}/", methods=["DELETE"])
async def delete_group(
    request: Request,
    group_id: int,
    db: Session = Depends(get_db)
):
    logger.info(f"DELETE /groups/{group_id} - Headers: {request.headers}")
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # First delete all user associations
    db.query(UserGroup).filter(UserGroup.group_id == group_id).delete()
    
    # Then delete the group
    db.delete(group)
    db.commit()
    await delete_pattern('groups_list*')
    return {"message": "Group deleted successfully"}

@router.get("/{group_id}/users", response_model=List[UserResponse])
def get_group_users(group_id: int, db: Session = Depends(get_db)):
    """
    Get all users in a specific group.
    """
    try:
        # Get the group with its user_groups and related users
        group = db.query(Group).options(
            joinedload(Group.user_groups).joinedload(UserGroup.user)
        ).filter(Group.id == group_id).first()
        
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Extract the users from the user_groups relationship
        users = [user_group.user for user_group in group.user_groups]
        # Manually serialize users (no ORM objects)
        user_responses = []
        for user in users:
            user_responses.append({
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
                "role": user.role
            })
        return user_responses
        
    except Exception as e:
        logger.error(f"Error getting group users: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
