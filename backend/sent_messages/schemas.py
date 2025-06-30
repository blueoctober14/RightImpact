from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SentMessageEnriched(BaseModel):
    id: int
    message_template_id: str
    message_template_name: str
    shared_contact_id: Optional[str] = None  # Made optional to match model
    contact_first_name: Optional[str]
    contact_last_name: Optional[str]
    contact_phone: Optional[str]
    user_id: int
    username: str
    sent_at: datetime

    class Config:
        orm_mode = True
