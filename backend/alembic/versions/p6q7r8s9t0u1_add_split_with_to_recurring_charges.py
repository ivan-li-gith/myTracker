"""add split_with to recurring_charges

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'p6q7r8s9t0u1'
down_revision: Union[str, Sequence[str], None] = 'o5p6q7r8s9t0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('recurring_charges', sa.Column('split_with', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('recurring_charges', 'split_with')
