"""add stock_dividends table

Revision ID: 192354571fce
Revises: a451d9cc2487
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '192354571fce'
down_revision: Union[str, Sequence[str], None] = 'a451d9cc2487'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'stock_dividends',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('stock_holding_id', sa.Integer(), sa.ForeignKey('stock_holdings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('paid_at', sa.Date(), nullable=False),
        sa.Column('dividend_per_share', sa.Numeric(12, 6), nullable=False),
        sa.Column('shares_held', sa.Numeric(14, 6), nullable=False),
        sa.Column('reinvested', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('stock_dividends')
