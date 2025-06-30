"""Add message_template_groups association table"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        'message_template_groups',
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['template_id'], ['message_templates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('template_id', 'group_id')
    )


def downgrade():
    op.drop_table('message_template_groups')
