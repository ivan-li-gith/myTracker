"""add credit_card_id to recurring_charges

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'm3n4o5p6q7r8'
down_revision: Union[str, Sequence[str], None] = 'l2m3n4o5p6q7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'recurring_charges',
        sa.Column('credit_card_id', sa.Integer(), sa.ForeignKey('credit_cards.id', ondelete='SET NULL'), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('recurring_charges', 'credit_card_id')
