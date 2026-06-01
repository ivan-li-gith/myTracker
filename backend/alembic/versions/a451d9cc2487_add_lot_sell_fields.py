"""add sold_price and sold_at to stock_lots

Revision ID: a1b2c3d4e5f6
Revises: z6a7b8c9d0e1
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a451d9cc2487'
down_revision: Union[str, Sequence[str], None] = 'z6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('stock_lots', sa.Column('sold_price', sa.Numeric(12, 4), nullable=True))
    op.add_column('stock_lots', sa.Column('sold_at', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('stock_lots', 'sold_at')
    op.drop_column('stock_lots', 'sold_price')
