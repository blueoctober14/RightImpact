# Import all message models to make them available when importing from models.messages
from .message_template import MessageTemplate
from .user_message_template import UserMessageTemplate
from .message import Message

# Make these available at the package level
__all__ = [
    'MessageTemplate',
    'UserMessageTemplate',
    'Message',
]
