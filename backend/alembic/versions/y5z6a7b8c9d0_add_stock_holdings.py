"""add stock_holdings table

Revision ID: y5z6a7b8c9d0
Revises: x4y5z6a7b8c9
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'y5z6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'x4y5z6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'stock_holdings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ticker', sa.Text(), nullable=False),
        sa.Column('company_name', sa.Text(), nullable=True),
        sa.Column('shares', sa.Numeric(14, 6), nullable=False),
        sa.Column('buy_price', sa.Numeric(12, 4), nullable=False),
        sa.Column('current_price', sa.Numeric(12, 4), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('stock_holdings')
