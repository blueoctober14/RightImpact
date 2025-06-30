"""Make shared_contact_id nullable

Revision ID: 20250628212500
Revises: 
Create Date: 2025-06-28 21:25:00.000000
"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    # Alter the shared_contact_id column to be nullable
    op.alter_column('sent_messages', 'shared_contact_id',
                   existing_type=sa.String(),
                   nullable=True)


def downgrade():
    # Revert the change (make column not nullable again)
    op.alter_column('sent_messages', 'shared_contact_id',
                   existing_type=sa.String(),
                   nullable=False)
