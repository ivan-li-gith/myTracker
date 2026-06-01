"""add stock_lots table

Revision ID: z6a7b8c9d0e1
Revises: y5z6a7b8c9d0
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'z6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'y5z6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'stock_lots',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('stock_holding_id', sa.Integer(), sa.ForeignKey('stock_holdings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('shares', sa.Numeric(14, 6), nullable=False),
        sa.Column('buy_price', sa.Numeric(12, 4), nullable=False),
        sa.Column('purchased_at', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Migrate existing holdings into lots (one lot per holding)
    op.execute(sa.text(
        "INSERT INTO stock_lots (stock_holding_id, shares, buy_price) "
        "SELECT id, shares, buy_price FROM stock_holdings"
    ))
    op.drop_column('stock_holdings', 'shares')
    op.drop_column('stock_holdings', 'buy_price')


def downgrade() -> None:
    op.add_column('stock_holdings', sa.Column('shares', sa.Numeric(14, 6), nullable=True))
    op.add_column('stock_holdings', sa.Column('buy_price', sa.Numeric(12, 4), nullable=True))
    op.execute(sa.text("""
        UPDATE stock_holdings sh
        SET shares = lots.total_shares, buy_price = lots.avg_price
        FROM (
            SELECT stock_holding_id,
                   SUM(shares) AS total_shares,
                   SUM(shares * buy_price) / NULLIF(SUM(shares), 0) AS avg_price
            FROM stock_lots
            GROUP BY stock_holding_id
        ) lots
        WHERE sh.id = lots.stock_holding_id
    """))
    op.alter_column('stock_holdings', 'shares', nullable=False)
    op.alter_column('stock_holdings', 'buy_price', nullable=False)
    op.drop_table('stock_lots')
