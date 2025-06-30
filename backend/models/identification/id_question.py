from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import json

from models.base import Base

class IdQuestion(Base):
    __tablename__ = "id_questions"
    __allow_unmapped__ = True

    id = Column(Integer, primary_key=True, index=True)

    # JSON array of user IDs assigned to this question. Empty list = all users
    assigned_user_ids_json = Column(Text, nullable=True, default="[]")

    title = Column(String, nullable=False)
    question_text = Column(Text, nullable=False)

    # Response type can be: MC_SINGLE, MC_MULTI, SLIDER, TEXT
    response_type = Column(String, nullable=False)

    # JSON array of up to 10 possible choices (strings) for MC types
    possible_choices_json = Column(Text, nullable=True, default="[]")

    notes_enabled = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to answers
    answers = relationship("IdAnswer", back_populates="question", cascade="all, delete-orphan")

    # Helper methods to access arrays as Python lists
    @property
    def assigned_user_ids(self):
        try:
            return json.loads(self.assigned_user_ids_json) if self.assigned_user_ids_json else []
        except Exception:
            return []

    @assigned_user_ids.setter
    def assigned_user_ids(self, value):
        self.assigned_user_ids_json = json.dumps(value or [])

    @property
    def possible_choices(self):
        try:
            return json.loads(self.possible_choices_json) if self.possible_choices_json else []
        except Exception:
            return []

    @possible_choices.setter
    def possible_choices(self, value):
        self.possible_choices_json = json.dumps(value or [])

