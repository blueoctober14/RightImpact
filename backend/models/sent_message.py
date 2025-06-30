from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class SentMessage(Base):
    __tablename__ = "sent_messages"

    id = Column(Integer, primary_key=True, index=True)
    message_template_id = Column(String, nullable=False)
    shared_contact_id = Column(String, nullable=True)  # Changed to nullable for neighbor messages
    target_contact_id = Column(String, nullable=True)  # New field for neighbor messages
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to User
    user = relationship("User", backref="sent_messages")

    from sqlalchemy import cast, Integer, ForeignKey
    shared_contact = relationship(
        "SharedContact",
        primaryjoin="cast(SentMessage.shared_contact_id, Integer)==SharedContact.id",
        foreign_keys=[shared_contact_id],
        back_populates="sent_messages"
    )

    target_contact = relationship(
        "TargetContact",
        primaryjoin="cast(SentMessage.target_contact_id, Integer)==TargetContact.id",
        foreign_keys=[target_contact_id]
        # Removed back_populates since we'll define it in TargetContact
    )
