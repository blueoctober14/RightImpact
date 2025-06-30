"""Fix message status enum values to use uppercase

Revision ID: fix_message_status_enum
Revises: 
Create Date: 2025-06-26

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'fix_message_status_enum'
branch_labels = None
depends_on = None

def upgrade():
    # Check if the enum type exists
    conn = op.get_bind()
    
    # For PostgreSQL
    if conn.dialect.name == 'postgresql':
        # Create a new enum type with correct values
        op.execute("""
            CREATE TYPE messagestatus_new AS ENUM ('ACTIVE', 'INACTIVE');
            
            -- Convert existing data to new enum
            ALTER TABLE message_templates 
            ALTER COLUMN status TYPE messagestatus_new 
            USING (CASE status 
                WHEN 'active' THEN 'ACTIVE'::messagestatus_new 
                WHEN 'inactive' THEN 'INACTIVE'::messagestatus_new 
                ELSE 'INACTIVE'::messagestatus_new 
            END);
            
            -- Drop the old type
            DROP TYPE messagestatus;
            
            -- Rename the new type
            ALTER TYPE messagestatus_new RENAME TO messagestatus;
        """)
    else:
        # For SQLite, we need to recreate the table
        with op.batch_alter_table('message_templates') as batch_op:
            # Rename old table
            batch_op.alter_column('status', 
                               type_=sa.Enum('ACTIVE', 'INACTIVE', name='messagestatus'),
                               existing_type=sa.String(),
                               postgresql_using="CASE status 
                                   WHEN 'active' THEN 'ACTIVE'::messagestatus 
                                   WHEN 'inactive' THEN 'INACTIVE'::messagestatus 
                                   ELSE 'INACTIVE'::messagestatus 
                               END")

def downgrade():
    # Revert back to lowercase values if needed
    conn = op.get_bind()
    
    if conn.dialect.name == 'postgresql':
        op.execute("""
            CREATE TYPE messagestatus_old AS ENUM ('active', 'inactive');
            
            ALTER TABLE message_templates 
            ALTER COLUMN status TYPE messagestatus_old 
            USING (LOWER(status)::messagestatus_old);
            
            DROP TYPE messagestatus;
            ALTER TYPE messagestatus_old RENAME TO messagestatus;
        """)
    else:
        # For SQLite
        with op.batch_alter_table('message_templates') as batch_op:
            batch_op.alter_column('status',
                               type_=sa.String(),
                               existing_type=sa.Enum('ACTIVE', 'INACTIVE', name='messagestatus'),
                               postgresql_using="LOWER(status)")
