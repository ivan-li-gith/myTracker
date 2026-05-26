"""add split_with to expenses

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'o5p6q7r8s9t0'
down_revision: Union[str, Sequence[str], None] = 'n4o5p6q7r8s9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('expenses', sa.Column('split_with', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('expenses', 'split_with')
