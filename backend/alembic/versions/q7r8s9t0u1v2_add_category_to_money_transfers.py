"""add category_id to money_transfers

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'q7r8s9t0u1v2'
down_revision: Union[str, Sequence[str], None] = 'p6q7r8s9t0u1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('money_transfers', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_money_transfers_category_id',
        'money_transfers', 'categories',
        ['category_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_money_transfers_category_id', 'money_transfers', type_='foreignkey')
    op.drop_column('money_transfers', 'category_id')
