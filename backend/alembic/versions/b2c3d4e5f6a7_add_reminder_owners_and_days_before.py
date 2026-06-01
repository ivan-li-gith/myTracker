"""add reminder_owners table and days_before to credit_card_reminders

Revision ID: b2c3d4e5f6a7
Revises: 192354571fce
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = '192354571fce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reminder_owners',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.Text(), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.add_column('credit_card_reminders', sa.Column('days_before', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('credit_card_reminders', 'days_before')
    op.drop_table('reminder_owners')
