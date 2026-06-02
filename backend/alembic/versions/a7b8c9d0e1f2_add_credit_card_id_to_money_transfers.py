"""add credit_card_id to money_transfers

Revision ID: a7b8c9d0e1f2
Revises: z6a7b8c9d0e1
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4g5h6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('money_transfers', sa.Column(
        'credit_card_id',
        sa.Integer(),
        sa.ForeignKey('credit_cards.id', ondelete='SET NULL'),
        nullable=True,
    ))


def downgrade() -> None:
    op.drop_column('money_transfers', 'credit_card_id')
