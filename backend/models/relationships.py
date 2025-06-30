"""Centralized relationship definitions for SQLAlchemy models.

This module contains all relationship definitions to avoid circular imports.
"""
from sqlalchemy.orm import relationship
from models.associations import message_template_lists
from models.messages.message_template import MessageTemplate
from models.messages.user_message_template import UserMessageTemplate
from models.targets.target_list import TargetList
from models.targets.target_contact import TargetContact
from models.contact_match import ContactMatch
from models.shared_contact import SharedContact
from models.contacts.campaign_contact import CampaignContact
from models.user import User
from models.contact import Contact
from models.messages import Message

def setup_relationships():
    """Set up all model relationships after all models are defined."""
    # Import models here to avoid circular imports
    from models.contact_match import ContactMatch
    from models.targets.target_list import TargetList
    from models.targets.target_contact import TargetContact
    from models.shared_contact import SharedContact
    from models.contacts.campaign_contact import CampaignContact
    from models.user import User
    from models.contact import Contact
    from models.messages import Message, MessageTemplate, UserMessageTemplate

    # Set up ContactMatch relationships
    ContactMatch.shared_contact = relationship(
        "SharedContact", 
        back_populates="matches",
        foreign_keys=[ContactMatch.shared_contact_id],
        lazy="selectin"
    )
    ContactMatch.target_contact = relationship(
        "TargetContact", 
        back_populates="matches",
        foreign_keys=[ContactMatch.target_contact_id],
        lazy="selectin"
    )
    ContactMatch.target_list = relationship(
        "TargetList",
        back_populates="contact_matches",
        foreign_keys=[ContactMatch.target_list_id],
        lazy="selectin"
    )

    # Set up TargetList relationships
    TargetList.contacts = relationship(
        "TargetContact", 
        back_populates="target_list", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    TargetList.contact_matches = relationship(
        "ContactMatch", 
        back_populates="target_list", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    # Set up TargetContact relationships
    TargetContact.target_list = relationship(
        "TargetList",
        back_populates="contacts",
        lazy="selectin"
    )
    TargetContact.matches = relationship(
        "ContactMatch",
        back_populates="target_contact",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    # Set up SharedContact relationships
    SharedContact.user = relationship(
        "User",
        back_populates="shared_contacts",
        foreign_keys="[SharedContact.user_id]",
        lazy="selectin"
    )
    
    # Relationship with CampaignContact is now defined in the SharedContact model
    SharedContact.matches = relationship(
        "ContactMatch", 
        back_populates="shared_contact", 
        cascade="all, delete-orphan",
        foreign_keys="[ContactMatch.shared_contact_id]",
        lazy="selectin"
    )

    # Set up CampaignContact relationships
    # This is now defined directly in the CampaignContact model
    pass

    # Set up User relationships
    User.shared_contacts = relationship(
        "SharedContact",
        back_populates="user",
        foreign_keys="[SharedContact.user_id]",
        lazy="selectin"
    )
    
    # Set up User relationships
    User.assigned_contacts = relationship(
        "Contact",
        primaryjoin="User.id == Contact.assigned_to_id",
        foreign_keys="[Contact.assigned_to_id]",
        back_populates="assigned_to",
        lazy="selectin"
    )
    
    # Set up MessageTemplate relationships
    from models.messages.message_template import MessageTemplate
    from models.messages.user_message_template import UserMessageTemplate
    
    # MessageTemplate to User (many-to-many through UserMessageTemplate)
    MessageTemplate.users = relationship(
        "User",
        secondary="user_message_templates",
        back_populates="available_templates",
        lazy="selectin"
    )
    
    # MessageTemplate to TargetList (many-to-many)
    MessageTemplate.lists = relationship(
        "TargetList",
        secondary=message_template_lists,
        back_populates="message_templates",
        lazy="selectin"
    )
    
    # TargetList to MessageTemplate (many-to-many)
    TargetList.message_templates = relationship(
        "MessageTemplate",
        secondary=message_template_lists,
        back_populates="lists",
        lazy="selectin"
    )
    
    # User to MessageTemplate (many-to-many through UserMessageTemplate)
    User.available_templates = relationship(
        "MessageTemplate",
        secondary="user_message_templates",
        back_populates="users",
        lazy="selectin"
    )
    
    # UserMessageTemplate relationships
    UserMessageTemplate.user = relationship(
        "User",
        back_populates="user_message_templates",
        lazy="selectin"
    )
    
    UserMessageTemplate.template = relationship(
        "MessageTemplate",
        back_populates="user_assignments",
        lazy="selectin"
    )
    
    User.user_message_templates = relationship(
        "UserMessageTemplate",
        back_populates="user",
        lazy="selectin"
    )
    
    MessageTemplate.user_assignments = relationship(
        "UserMessageTemplate",
        back_populates="template",
        lazy="selectin"
    )
    
    # Set up Message relationships
    User.messages_sent = relationship(
        "Message",
        foreign_keys="[Message.sender_id]",
        back_populates="sender",
        lazy="selectin"
    )
    
    User.available_templates = relationship(
        "MessageTemplate",
        secondary="user_message_templates",
        back_populates="users",
        lazy="selectin"
    )
    
    User.user_templates = relationship(
        "UserMessageTemplate",
        back_populates="user",
        lazy="selectin"
    )
    
    # Set up Contact relationships
    Contact.assigned_to = relationship(
        "User",
        back_populates="assigned_contacts",
        foreign_keys="[Contact.assigned_to_id]",
        lazy="selectin"
    )
    
    # Set up Message relationships
    Message.sender = relationship(
        "User",
        foreign_keys="[Message.sender_id]",
        back_populates="messages_sent",
        lazy="selectin"
    )
    
    # Relationship with CampaignContact
    Message.contact = relationship(
        "CampaignContact",
        foreign_keys="[Message.contact_id]",
        back_populates="messages",
        lazy="selectin"
    )
    
    # Set up MessageTemplate relationships
    MessageTemplate.users = relationship(
        "User",
        secondary="user_message_templates",
        back_populates="available_templates",
        lazy="selectin"
    )
    
    # Set up UserMessageTemplate relationships
    UserMessageTemplate.user = relationship(
        "User",
        foreign_keys="[UserMessageTemplate.user_id]",
        back_populates="user_templates",
        lazy="selectin"
    )
    
    UserMessageTemplate.template = relationship(
        "MessageTemplate",
        foreign_keys="[UserMessageTemplate.template_id]",
        back_populates="user_assignments",
        lazy="selectin"
    )
    
    # Set up MessageTemplate relationships
    MessageTemplate.user_assignments = relationship(
        "UserMessageTemplate",
        foreign_keys="[UserMessageTemplate.template_id]",
        back_populates="template",
        lazy="selectin"
    )
    
    # Set up TargetList relationships
    from models.targets.target_list import TargetList
    from models.targets.target_contact import TargetContact
    from models.contact_match import ContactMatch
    
    TargetList.contacts = relationship(
        "TargetContact",
        foreign_keys="[TargetContact.list_id]",
        back_populates="target_list",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    TargetList.contact_matches = relationship(
        "ContactMatch",
        foreign_keys="[ContactMatch.target_list_id]",
        back_populates="target_list",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    # Set up TargetContact relationships
    TargetContact.target_list = relationship(
        "TargetList",
        foreign_keys="[TargetContact.list_id]",
        back_populates="contacts",
        lazy="selectin"
    )
    
    TargetContact.matches = relationship(
        "ContactMatch",
        foreign_keys="[ContactMatch.target_contact_id]",
        back_populates="target_contact",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    # Set up ContactMatch relationships with TargetList and TargetContact
    ContactMatch.target_list = relationship(
        "TargetList",
        foreign_keys="[ContactMatch.target_list_id]",
        back_populates="contact_matches",
        lazy="selectin"
    )
    
    ContactMatch.target_contact = relationship(
        "TargetContact",
        foreign_keys="[ContactMatch.target_contact_id]",
        back_populates="matches",
        lazy="selectin"
    )
