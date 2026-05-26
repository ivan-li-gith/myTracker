"""add service_period_start and service_period_end to expenses

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 's9t0u1v2w3x4'
down_revision: Union[str, Sequence[str], None] = 'r8s9t0u1v2w3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('expenses', sa.Column('service_period_start', sa.Date(), nullable=True))
    op.add_column('expenses', sa.Column('service_period_end', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('expenses', 'service_period_end')
    op.drop_column('expenses', 'service_period_start')
