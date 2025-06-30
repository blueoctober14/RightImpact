"""Update message template status column

Revision ID: 123456789abc
Revises: fde0b719fcbe
Create Date: 2025-06-26 22:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '123456789abc'
down_revision = 'fde0b719fcbe'
branch_labels = None
depends_on = None

def upgrade():
    # Make status column non-nullable with default 'INACTIVE'
    with op.batch_alter_table('message_templates') as batch_op:
        batch_op.alter_column(
            'status',
            existing_type=sa.VARCHAR(),
            nullable=False,
            server_default='INACTIVE',
            existing_server_default=None
        )

def downgrade():
    # Revert to nullable status column
    with op.batch_alter_table('message_templates') as batch_op:
        batch_op.alter_column(
            'status',
            existing_type=sa.VARCHAR(),
            nullable=True,
            server_default=None,
            existing_server_default='INACTIVE'
        )
