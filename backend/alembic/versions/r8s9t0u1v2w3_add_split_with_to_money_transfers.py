"""add split_with to money_transfers

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'r8s9t0u1v2w3'
down_revision: Union[str, Sequence[str], None] = 'q7r8s9t0u1v2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('money_transfers', sa.Column('split_with', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('money_transfers', 'split_with')
