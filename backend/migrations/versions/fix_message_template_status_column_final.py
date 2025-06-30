"""Final fix for message template status column

Revision ID: 3456789abcde
Revises: 23456789abcd
Create Date: 2025-06-27 08:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '3456789abcde'
down_revision = '23456789abcd'
branch_labels = None
depends_on = None

def upgrade():
    # First, update any NULL values to 'INACTIVE'
    op.execute("UPDATE message_templates SET status = 'INACTIVE' WHERE status IS NULL")
    
    # Then alter the column to be non-nullable with a default
    with op.batch_alter_table('message_templates') as batch_op:
        batch_op.alter_column(
            'status',
            existing_type=sa.String(),
            nullable=False,
            server_default='INACTIVE'
        )

def downgrade():
    # Revert to nullable column without default
    with op.batch_alter_table('message_templates') as batch_op:
        batch_op.alter_column(
            'status',
            existing_type=sa.String(),
            nullable=True,
            server_default=None
        )
