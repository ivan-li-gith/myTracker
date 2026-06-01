"""add account fields to banks and from/to bank refs to money_transfers

Revision ID: c1d2e3f4g5h6
Revises: b2c3d4e5f6a7
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c1d2e3f4g5h6'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('banks', sa.Column('account_type', sa.Text(), nullable=True))
    op.add_column('banks', sa.Column('starting_balance', sa.Numeric(10, 2), nullable=True))
    op.add_column('banks', sa.Column('starting_balance_as_of', sa.Date(), nullable=True))

    op.add_column(
        'money_transfers',
        sa.Column('from_bank_id', sa.Integer(), sa.ForeignKey('banks.id', ondelete='SET NULL'), nullable=True),
    )
    op.add_column(
        'money_transfers',
        sa.Column('to_bank_id', sa.Integer(), sa.ForeignKey('banks.id', ondelete='SET NULL'), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('money_transfers', 'to_bank_id')
    op.drop_column('money_transfers', 'from_bank_id')
    op.drop_column('banks', 'starting_balance_as_of')
    op.drop_column('banks', 'starting_balance')
    op.drop_column('banks', 'account_type')
