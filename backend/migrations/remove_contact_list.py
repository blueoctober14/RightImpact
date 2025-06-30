"""Remove ContactList model and its table.

Revision ID: remove_contact_list
Revises: 
Create Date: 2025-06-16 17:20:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'remove_contact_list'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Drop the contact_lists table
    op.drop_table('contact_lists')

def downgrade():
    # Recreate the contact_lists table (if needed for rollback)
    op.create_table('contact_lists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
