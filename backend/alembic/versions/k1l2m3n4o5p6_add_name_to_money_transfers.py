"""add name column to money_transfers

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'k1l2m3n4o5p6'
down_revision: Union[str, Sequence[str], None] = 'j0k1l2m3n4o5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('money_transfers', sa.Column('name', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('money_transfers', 'name')
