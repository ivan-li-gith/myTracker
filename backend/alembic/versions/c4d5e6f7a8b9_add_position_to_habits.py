"""add position to habits

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('habits', sa.Column('position', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE habits SET position = subq.rn
        FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY category ORDER BY created_at) - 1 AS rn FROM habits) subq
        WHERE habits.id = subq.id
    """)


def downgrade() -> None:
    op.drop_column('habits', 'position')
