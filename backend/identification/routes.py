from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional, Dict, Any
import io
import csv

from database import get_db
from auth.dependencies import get_current_user, get_current_active_admin
from models import User
from . import crud, schemas
import models
from models.identification.id_question import IdQuestion

router = APIRouter(
    prefix="/api/identification",
    tags=["identification"],
    responses={404: {"description": "Not found"}},
)

# ---------------- QUESTIONS ----------------

@router.post("/questions", response_model=schemas.IdQuestion, status_code=status.HTTP_201_CREATED)
async def create_question(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data = await request.json()
    try:
        question_in = schemas.IdQuestionCreate(**data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    question = crud.create_question(db, question_in.model_dump())
    return question

@router.get("/questions", response_model=List[schemas.IdQuestion])
async def list_questions(
    is_active: Optional[bool] = None,
    response_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    questions = crud.get_questions(db, skip=skip, limit=limit, is_active=is_active, response_type=response_type)
    return questions

@router.get("/questions/{question_id}", response_model=schemas.IdQuestion)
async def get_question(question_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    question = crud.get_question(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    question.answers_count = len(question.answers)
    return question

@router.put("/questions/{question_id}", response_model=schemas.IdQuestion)
async def update_question(question_id: int, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = await request.json()
    question_in = schemas.IdQuestionUpdate(**data)
    updated = crud.update_question(db, question_id, question_in.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Question not found")
    return updated

@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(question_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    success = crud.delete_question(db, question_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete question (maybe has answers or not found)")
    return {"detail": "Deleted"}

# ---------------- ANSWERS ----------------

@router.post("/questions/{question_id}/answers", response_model=schemas.IdAnswer)
async def submit_answer(question_id: int, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = await request.json()
    answer_in = schemas.IdAnswerCreate(**data)
    question = crud.get_question(db, question_id)
    if not question or not question.is_active:
        raise HTTPException(status_code=404, detail="Question not found or inactive")

    answer = crud.create_answer(
        db,
        question=question,
        user_id=current_user.id,
        shared_contact_id=answer_in.shared_contact_id,
        data=answer_in.model_dump(exclude={"shared_contact_id"})
    )
    return answer

@router.get("/questions/{question_id}/answers", response_model=List[schemas.IdAnswer])
async def list_answers(question_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    answers = crud.get_answers_for_question(db, question_id, skip, limit)
    return answers

# ---------------- STATUS ----------------

@router.get("/status", response_model=List[schemas.ContactIdentificationStatus])
async def get_identification_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get identification status for all contacts"""
    # Get all active questions
    questions = crud.get_questions(db, is_active=True)
    total_questions = len(questions)
    
    # Get all answers by current user
    answers = crud.get_user_answers(db, user_id=current_user.id)
    
    # Group answers by contact
    contact_answers = {}
    for answer in answers:
        contact_id = answer.shared_contact_id
        if contact_id not in contact_answers:
            contact_answers[contact_id] = set()
        contact_answers[contact_id].add(answer.question_id)
    
    # Create status objects
    result = []
    for contact_id, answered_question_ids in contact_answers.items():
        result.append({
            "shared_contact_id": contact_id,
            "contact_id": contact_id,  # For compatibility
            "total_questions": total_questions,
            "answered_questions": len(answered_question_ids)
        })
    
    return result

@router.get("/contacts/{contact_id}/answers", response_model=List[schemas.ContactAnswer])
async def get_contact_answers(contact_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all answers for a specific contact"""
    answers = crud.get_answers_for_contact(db, contact_id=contact_id, user_id=current_user.id)
    
    result = []
    for answer in answers:
        answer_data = {
            "question_id": answer.question_id,
            "selected_choices": answer.selected_choices,
            "slider_answer": answer.slider_answer,
            "text_answer": answer.text_answer,
            "notes": answer.notes
        }
        result.append(answer_data)
    
    return result

@router.get("/answers", response_model=Dict[str, Any])
async def get_all_answers(
    user_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    question_id: Optional[int] = None,
    response_type: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 0,
    limit: int = 10,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Get all identification answers with filtering capabilities"""
    # Fetch all answers with details
    answers_query = db.query(
        models.identification.id_answer.IdAnswer,
        models.identification.id_question.IdQuestion.title.label("question_title"),
        models.identification.id_question.IdQuestion.question_text.label("question_text"),
        models.identification.id_question.IdQuestion.response_type.label("response_type"),
        models.shared_contact.SharedContact.first_name.label("contact_first_name"),
        models.shared_contact.SharedContact.last_name.label("contact_last_name"),
        func.coalesce(models.shared_contact.SharedContact.mobile1, '').label("contact_phone"),
        (User.first_name + ' ' + User.last_name).label("user_name"),
        User.email.label("user_email")
    ).join(
        models.identification.id_question.IdQuestion, models.identification.id_answer.IdAnswer.question_id == models.identification.id_question.IdQuestion.id
    ).join(
        models.shared_contact.SharedContact, models.identification.id_answer.IdAnswer.shared_contact_id == models.shared_contact.SharedContact.id
    ).join(
        User, models.identification.id_answer.IdAnswer.user_id == User.id
    )
    
    # Apply filters
    if user_id:
        answers_query = answers_query.filter(models.identification.id_answer.IdAnswer.user_id == user_id)
    
    if contact_id:
        answers_query = answers_query.filter(models.identification.id_answer.IdAnswer.shared_contact_id == contact_id)
    
    if question_id:
        answers_query = answers_query.filter(models.identification.id_answer.IdAnswer.question_id == question_id)
    
    if response_type:
        answers_query = answers_query.filter(models.identification.id_question.IdQuestion.response_type == response_type)
    
    if search:
        search_term = f"%{search}%"
        answers_query = answers_query.filter(
            or_(
                models.shared_contact.SharedContact.first_name.ilike(search_term),
                models.shared_contact.SharedContact.last_name.ilike(search_term),
                (User.first_name + ' ' + User.last_name).ilike(search_term),
                User.email.ilike(search_term),
                models.identification.id_question.IdQuestion.title.ilike(search_term),
                models.identification.id_question.IdQuestion.question_text.ilike(search_term),
                or_(
                    models.shared_contact.SharedContact.mobile1.ilike(search_term),
                    models.shared_contact.SharedContact.mobile2.ilike(search_term),
                    models.shared_contact.SharedContact.mobile3.ilike(search_term)
                )
            )
        )
    
    # Count total results
    total = answers_query.count()
    
    # Apply sorting
    if sort_by == "created_at":
        if sort_order == "desc":
            answers_query = answers_query.order_by(models.identification.id_answer.IdAnswer.created_at.desc())
        else:
            answers_query = answers_query.order_by(models.identification.id_answer.IdAnswer.created_at.asc())
    
    # Apply pagination
    answers_query = answers_query.offset(page * limit).limit(limit)
    
    # Execute query
    answers = answers_query.all()
    
    # Format results
    result = []
    for row in answers:
        answer = row[0]  # The Answer model instance
        result.append({
            "id": answer.id,
            "question_id": answer.question_id,
            "user_id": answer.user_id,
            "shared_contact_id": answer.shared_contact_id,
            "selected_choices": answer.selected_choices,
            "slider_answer": answer.slider_answer,
            "text_answer": answer.text_answer,
            "notes": answer.notes,
            "created_at": answer.created_at.isoformat() if answer.created_at else None,
            "question_title": row.question_title,
            "question_text": row.question_text,
            "response_type": row.response_type,
            "contact_first_name": row.contact_first_name,
            "contact_last_name": row.contact_last_name,
            "contact_phone": row.contact_phone,
            "user_name": row.user_name,
            "user_email": row.user_email
        })
    
    return {"data": result, "total": total}

@router.get("/answers/export")
async def export_answers(
    user_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    question_id: Optional[int] = None,
    response_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Export all identification answers as CSV"""
    # Use the same query logic as get_all_answers but without pagination
    answers_query = db.query(
        models.identification.id_answer.IdAnswer,
        models.identification.id_question.IdQuestion.title.label("question_title"),
        models.identification.id_question.IdQuestion.question_text.label("question_text"),
        models.identification.id_question.IdQuestion.response_type.label("response_type"),
        models.shared_contact.SharedContact.first_name.label("contact_first_name"),
        models.shared_contact.SharedContact.last_name.label("contact_last_name"),
        func.coalesce(models.shared_contact.SharedContact.mobile1, '').label("contact_phone"),
        (User.first_name + ' ' + User.last_name).label("user_name"),
        User.email.label("user_email")
    ).join(
        models.identification.id_question.IdQuestion, models.identification.id_answer.IdAnswer.question_id == models.identification.id_question.IdQuestion.id
    ).join(
        models.shared_contact.SharedContact, models.identification.id_answer.IdAnswer.shared_contact_id == models.shared_contact.SharedContact.id
    ).join(
        User, models.identification.id_answer.IdAnswer.user_id == User.id
    )
    
    # Apply filters
    if user_id:
        answers_query = answers_query.filter(models.identification.id_answer.IdAnswer.user_id == user_id)
    
    if contact_id:
        answers_query = answers_query.filter(models.identification.id_answer.IdAnswer.shared_contact_id == contact_id)
    
    if question_id:
        answers_query = answers_query.filter(models.identification.id_answer.IdAnswer.question_id == question_id)
    
    if response_type:
        answers_query = answers_query.filter(models.identification.id_question.IdQuestion.response_type == response_type)
    
    if search:
        search_term = f"%{search}%"
        answers_query = answers_query.filter(
            or_(
                models.shared_contact.SharedContact.first_name.ilike(search_term),
                models.shared_contact.SharedContact.last_name.ilike(search_term),
                (User.first_name + ' ' + User.last_name).ilike(search_term),
                User.email.ilike(search_term),
                models.identification.id_question.IdQuestion.title.ilike(search_term),
                models.identification.id_question.IdQuestion.question_text.ilike(search_term),
                or_(
                    models.shared_contact.SharedContact.mobile1.ilike(search_term),
                    models.shared_contact.SharedContact.mobile2.ilike(search_term),
                    models.shared_contact.SharedContact.mobile3.ilike(search_term)
                )
            )
        )
    
    # Order by created_at
    answers_query = answers_query.order_by(models.identification.id_answer.IdAnswer.created_at.desc())
    
    # Execute query
    answers = answers_query.all()
    
    # Create CSV content
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write headers
    writer.writerow([
        "ID", "Question Title", "Question Text", "Response Type", 
        "Contact First Name", "Contact Last Name", "Contact Phone",
        "Answer", "Notes", "User Name", "User Email", "Created At"
    ])
    
    # Write data rows
    for row in answers:
        answer = row[0]  # The Answer model instance
        
        # Format answer based on response type
        formatted_answer = ""
        if row.response_type in ["MC_SINGLE", "MC_MULTI"]:
            formatted_answer = ", ".join(answer.selected_choices) if answer.selected_choices else ""
        elif row.response_type == "SLIDER":
            formatted_answer = str(answer.slider_answer) if answer.slider_answer is not None else ""
        elif row.response_type == "TEXT":
            formatted_answer = answer.text_answer or ""
        
        writer.writerow([
            answer.id,
            row.question_title,
            row.question_text,
            row.response_type,
            row.contact_first_name,
            row.contact_last_name,
            row.contact_phone,
            formatted_answer,
            answer.notes or "",
            row.user_name,
            row.user_email,
            answer.created_at.isoformat() if answer.created_at else ""
        ])
    
    # Create response with CSV file
    output.seek(0)
    headers = {
        "Content-Disposition": "attachment; filename=identification_answers.csv",
        "Content-Type": "text/csv"
    }
    return StreamingResponse(iter([output.getvalue()]), headers=headers)
