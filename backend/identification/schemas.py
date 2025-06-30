from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime

ResponseType = Literal["MC_SINGLE", "MC_MULTI", "SLIDER", "TEXT"]

class IdQuestionBase(BaseModel):
    title: str
    question_text: str
    response_type: ResponseType
    possible_choices: List[str] = Field(default_factory=list, max_items=10)
    notes_enabled: bool = False
    is_active: bool = True
    assigned_user_ids: List[int] = Field(default_factory=list)

class IdQuestionCreate(IdQuestionBase):
    pass

class IdQuestionUpdate(BaseModel):
    title: Optional[str] = None
    question_text: Optional[str] = None
    response_type: Optional[ResponseType] = None
    possible_choices: Optional[List[str]] = None
    notes_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    assigned_user_ids: Optional[List[int]] = None

class IdQuestion(IdQuestionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    answers_count: int = 0

    class Config:
        from_attributes = True

class IdAnswerBase(BaseModel):
    selected_choices: List[str] = Field(default_factory=list)
    slider_answer: Optional[int] = None
    text_answer: Optional[str] = None
    notes: Optional[str] = None

class IdAnswerCreate(IdAnswerBase):
    shared_contact_id: int

class IdAnswer(IdAnswerBase):
    id: int
    question_id: int
    user_id: int
    shared_contact_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ContactIdentificationStatus(BaseModel):
    shared_contact_id: int
    contact_id: int
    total_questions: int
    answered_questions: int
    
class ContactAnswer(BaseModel):
    question_id: int
    selected_choices: Optional[List[str]] = None
    slider_answer: Optional[int] = None
    text_answer: Optional[str] = None
    notes: Optional[str] = None
