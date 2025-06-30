"""Models package initialization.

This module imports all models and sets up their relationships.
"""
# Import all models first (order matters for SQLAlchemy)
from .base import Base
from .user import User
from .group import Group, UserGroup
from .contact import Contact
from .messages import Message, MessageTemplate, UserMessageTemplate
from .targets.target_list import TargetList
from .targets.target_contact import TargetContact
from .shared_contact import SharedContact
from .contacts.campaign_contact import CampaignContact
from .contact_match import ContactMatch
from .sent_message import SentMessage
from .identification.id_question import IdQuestion
from .identification.id_answer import IdAnswer
# ContactList model has been removed, using TargetList instead

# Import the relationship setup function
from .relationships import setup_relationships

# Set up all relationships after all models are imported
setup_relationships()

# Configure mappers after setting up relationships
from sqlalchemy.orm import configure_mappers
configure_mappers()

# Make all models available at the package level
__all__ = [
    'Base',
    'User',
    'Contact',
    'Message',
    'MessageTemplate',
    'UserMessageTemplate',
    'TargetList',
    'TargetContact',
    'SharedContact',
    'CampaignContact',
    'ContactMatch',
    'Group',
    'UserGroup',
    'SentMessage',
    'IdQuestion',
    'IdAnswer',
]
