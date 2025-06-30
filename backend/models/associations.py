from sqlalchemy import Table, Column, Integer, ForeignKey
from models.base import Base

# Association table for many-to-many relationship between message templates and target lists
message_template_lists = Table(
    'message_template_lists',
    Base.metadata,
    Column('template_id', Integer, ForeignKey('message_templates.id', ondelete='CASCADE'), primary_key=True),
    Column('list_id', Integer, ForeignKey('target_lists.id', ondelete='CASCADE'), primary_key=True)
)

# Association table for many-to-many relationship between message templates and groups
message_template_groups = Table(
    'message_template_groups',
    Base.metadata,
    Column('template_id', Integer, ForeignKey('message_templates.id', ondelete='CASCADE'), primary_key=True),
    Column('group_id', Integer, ForeignKey('groups.id', ondelete='CASCADE'), primary_key=True)
)