"""Update message template status values

Revision ID: update_message_template_status
Revises: 
Create Date: 2025-06-26

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'update_message_template_status'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Update existing 'draft' status to 'inactive'
    op.execute("""
        UPDATE message_templates 
        SET status = 'inactive' 
        WHERE status = 'draft' OR status IS NULL
    """)

def downgrade():
    # Revert 'inactive' back to 'draft'
    op.execute("""
        UPDATE message_templates 
        SET status = 'draft' 
        WHERE status = 'inactive'
    """)
