"""Update message template status to use enum

Revision ID: update_message_template_status_enum
Revises: 
Create Date: 2025-06-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'update_message_template_status_enum'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create the enum type
    op.execute("""
        CREATE TYPE messagestatus AS ENUM ('ACTIVE', 'INACTIVE');
    """)
    
    # Add a temporary column with the new enum type
    op.add_column('message_templates', 
        sa.Column('status_new', sa.Enum('ACTIVE', 'INACTIVE', name='messagestatus'), 
                 nullable=False, server_default='INACTIVE'))
    
    # Copy data from old column to new column
    op.execute("""
        UPDATE message_templates 
        SET status_new = status::messagestatus;
    """)
    
    # Drop the old column
    op.drop_column('message_templates', 'status')
    
    # Rename the new column
    op.alter_column('message_templates', 'status_new', new_column_name='status')

def downgrade():
    # Revert back to string type
    op.alter_column('message_templates', 'status', 
                   type_=sa.String(),
                   postgresql_using='status::text',
                   nullable=True)
    
    # Drop the enum type
    op.execute("DROP TYPE IF EXISTS messagestatus")
