from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal
from datetime import datetime

# Message type values as string literals for Pydantic
MessageType = Literal["friend_to_friend", "neighbor_to_neighbor", "social_media"]

# Status values as string literals for Pydantic
MessageStatus = Literal["ACTIVE", "INACTIVE", "DRAFT", "ARCHIVED"]

class MessageTemplateBase(BaseModel):
    name: str
    message_type: MessageType
    content: str
    media_url: Optional[str] = None
    status: MessageStatus = "INACTIVE"

class MessageTemplateCreate(MessageTemplateBase):
    list_ids: List[int] = Field(default_factory=list)
    user_ids: List[int] = Field(default_factory=list)
    group_ids: List[int] = Field(default_factory=list)

class MessageTemplateUpdate(BaseModel):
    name: Optional[str] = None
    message_type: Optional[MessageType] = None
    content: Optional[str] = None
    media_url: Optional[str] = None
    status: Optional[MessageStatus] = None
    list_ids: Optional[List[int]] = None
    user_ids: Optional[List[int]] = None
    group_ids: Optional[List[int]] = None

class MessageTemplate(MessageTemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime
    lists: List[dict] = []
    users: List[dict] = []
    groups: List[dict] = []
    sent_count: int = 0  # <-- Add this line

    class Config:
        from_attributes = True
