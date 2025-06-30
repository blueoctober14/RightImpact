from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from typing import List, Optional
import json

from models.identification.id_question import IdQuestion
from models.identification.id_answer import IdAnswer

# ---------- Question CRUD ----------

def create_question(db: Session, data: dict) -> IdQuestion:
    question = IdQuestion(**data)
    db.add(question)
    db.commit()
    db.refresh(question)
    return question

def get_question(db: Session, question_id: int) -> Optional[IdQuestion]:
    return (
        db.query(IdQuestion)
        .options(selectinload(IdQuestion.answers))
        .filter(IdQuestion.id == question_id)
        .first()
    )

def get_questions(db: Session, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None, response_type: Optional[str] = None):
    query = db.query(IdQuestion)
    if is_active is not None:
        query = query.filter(IdQuestion.is_active == is_active)
    if response_type:
        query = query.filter(IdQuestion.response_type == response_type)

    questions = (
        query.offset(skip).limit(limit).all()
    )

    # Add answers_count for convenience
    for q in questions:
        q.answers_count = len(q.answers)
    return questions

def update_question(db: Session, question_id: int, data: dict) -> Optional[IdQuestion]:
    question = db.query(IdQuestion).get(question_id)
    if not question:
        return None

    for key, value in data.items():
        if value is not None:
            setattr(question, key, value)
    db.commit()
    db.refresh(question)
    return question

def delete_question(db: Session, question_id: int) -> bool:
    question = db.query(IdQuestion).get(question_id)
    if not question:
        return False
    if question.answers:
        # Cannot delete if there are answers
        return False
    db.delete(question)
    db.commit()
    return True

# ---------- Answer CRUD ----------

def create_answer(db: Session, question: IdQuestion, user_id: int, shared_contact_id: int, data: dict) -> IdAnswer:
    answer = IdAnswer(
        question_id=question.id,
        user_id=user_id,
        shared_contact_id=shared_contact_id,
        **data
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return answer

def get_answers_for_question(db: Session, question_id: int, skip: int = 0, limit: int = 100):
    return (
        db.query(IdAnswer)
        .filter(IdAnswer.question_id == question_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_user_answers(db: Session, user_id: int):
    """Get all answers submitted by a specific user"""
    return (
        db.query(IdAnswer)
        .filter(IdAnswer.user_id == user_id)
        .all()
    )

def get_answers_for_contact(db: Session, contact_id: int, user_id: int):
    """Get all answers for a specific contact submitted by a specific user"""
    return (
        db.query(IdAnswer)
        .filter(IdAnswer.shared_contact_id == contact_id)
        .filter(IdAnswer.user_id == user_id)
        .all()
    )
