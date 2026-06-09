"""add companies and company_id to work_log_entries

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'companies',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.Text(), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.execute("INSERT INTO companies (name) VALUES ('Advantage Microsystems')")

    op.add_column('work_log_entries', sa.Column('company_id', sa.Integer(), nullable=True))

    op.execute("""
        UPDATE work_log_entries
        SET company_id = (SELECT id FROM companies WHERE name = 'Advantage Microsystems')
    """)

    op.alter_column('work_log_entries', 'company_id', nullable=False)

    op.create_foreign_key(
        'fk_work_log_entries_company_id',
        'work_log_entries', 'companies',
        ['company_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_work_log_entries_company_id', 'work_log_entries', type_='foreignkey')
    op.drop_column('work_log_entries', 'company_id')
    op.drop_table('companies')
