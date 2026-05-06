"""replace is_canceled with canceled_from on recurring_charges

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-05 02:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('recurring_charges', 'is_canceled')
    op.add_column(
        'recurring_charges',
        sa.Column('canceled_from', sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('recurring_charges', 'canceled_from')
    op.add_column(
        'recurring_charges',
        sa.Column('is_canceled', sa.Boolean(), nullable=False, server_default='false'),
    )
