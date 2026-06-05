"""add work_log_entries table

Revision ID: b8c9d0e1f2g3
Revises: a7b8c9d0e1f2, c1d2e3f4g5h6
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b8c9d0e1f2g3'
down_revision: Union[str, Sequence[str], None] = ('a7b8c9d0e1f2', 'c1d2e3f4g5h6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'work_log_entries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Text(), nullable=False),
        sa.Column('end_time', sa.Text(), nullable=False),
        sa.Column('category', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('work_log_entries')
