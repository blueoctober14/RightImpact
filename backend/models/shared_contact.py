from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from models.base import Base

class SharedContact(Base):
    __tablename__ = "shared_contacts"
    __allow_unmapped__ = True

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    mobile1 = Column(String, nullable=True)
    mobile2 = Column(String, nullable=True)
    mobile3 = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip = Column(String, nullable=True)
    company = Column(Text, nullable=True)
    matched = Column(Boolean, default=False, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship with CampaignContact
    campaign_contacts = relationship("CampaignContact", back_populates="matched_shared_contact")
    from models.sent_message import SentMessage
    sent_messages = relationship(
        "SentMessage",
        back_populates="shared_contact",
        primaryjoin="SharedContact.id==cast(SentMessage.shared_contact_id, Integer)",
        foreign_keys=[SentMessage.shared_contact_id]
    )

    @property
    def phone_number(self):
        """Backward compatibility for code that expects phone_number"""
        return self.mobile1
