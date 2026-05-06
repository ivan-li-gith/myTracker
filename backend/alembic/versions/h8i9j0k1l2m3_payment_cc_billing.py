"""add credit_card_id and billing dates to payments

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'h8i9j0k1l2m3'
down_revision: Union[str, Sequence[str], None] = 'g7h8i9j0k1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('payments', sa.Column('credit_card_id', sa.Integer(), nullable=True))
    op.add_column('payments', sa.Column('billing_start_date', sa.Date(), nullable=True))
    op.add_column('payments', sa.Column('billing_end_date', sa.Date(), nullable=True))
    op.create_foreign_key(
        'payments_credit_card_id_fkey',
        'payments', 'credit_cards',
        ['credit_card_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('payments_credit_card_id_fkey', 'payments', type_='foreignkey')
    op.drop_column('payments', 'billing_end_date')
    op.drop_column('payments', 'billing_start_date')
    op.drop_column('payments', 'credit_card_id')
