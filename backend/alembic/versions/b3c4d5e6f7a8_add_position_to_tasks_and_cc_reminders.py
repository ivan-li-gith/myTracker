"""add position to tasks and credit_card_reminders

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, Sequence[str], None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('position', sa.Integer(), nullable=True))
    op.add_column('credit_card_reminders', sa.Column('position', sa.Integer(), nullable=True))
    # Backfill positions so existing rows have a stable initial order
    op.execute("""
        UPDATE tasks SET position = subq.rn
        FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS rn FROM tasks) subq
        WHERE tasks.id = subq.id
    """)
    op.execute("""
        UPDATE credit_card_reminders SET position = subq.rn
        FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY owner ORDER BY due_day, created_at) - 1 AS rn FROM credit_card_reminders) subq
        WHERE credit_card_reminders.id = subq.id
    """)


def downgrade() -> None:
    op.drop_column('tasks', 'position')
    op.drop_column('credit_card_reminders', 'position')
