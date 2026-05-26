"""add category to habits

Revision ID: w3x4y5z6a7b8
Revises: v2w3x4y5z6a7
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'w3x4y5z6a7b8'
down_revision: Union[str, Sequence[str], None] = 'v2w3x4y5z6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'habits',
        sa.Column('category', sa.Text(), nullable=False, server_default='standard'),
    )


def downgrade() -> None:
    op.drop_column('habits', 'category')
