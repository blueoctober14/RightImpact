"""Add zip_code to users"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('users', sa.Column('zip_code', sa.String(10), nullable=True))


def downgrade():
    op.drop_column('users', 'zip_code')
