from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import json

from models.base import Base

class IdAnswer(Base):
    __tablename__ = "id_answers"
    __allow_unmapped__ = True

    id = Column(Integer, primary_key=True, index=True)

    question_id = Column(Integer, ForeignKey("id_questions.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    shared_contact_id = Column(Integer, ForeignKey("shared_contacts.id"), nullable=False, index=True)

    # JSON array of selected choices for MC_MULTI or MC_SINGLE (store list for uniformity)
    selected_choices_json = Column(Text, nullable=True, default="[]")

    slider_answer = Column(Integer, nullable=True)
    text_answer = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    question = relationship("IdQuestion", back_populates="answers")
    user = relationship("User")
    shared_contact = relationship("SharedContact")

    # Helper property
    @property
    def selected_choices(self):
        try:
            return json.loads(self.selected_choices_json) if self.selected_choices_json else []
        except Exception:
            return []

    @selected_choices.setter
    def selected_choices(self, value):
        self.selected_choices_json = json.dumps(value or [])
