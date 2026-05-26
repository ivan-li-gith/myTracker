"""add credit card reminders table

Revision ID: x4y5z6a7b8c9
Revises: w3x4y5z6a7b8
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'x4y5z6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'w3x4y5z6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'credit_card_reminders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('card_name', sa.Text(), nullable=False),
        sa.Column('owner', sa.Text(), nullable=True),
        sa.Column('due_day', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('credit_card_reminders')
