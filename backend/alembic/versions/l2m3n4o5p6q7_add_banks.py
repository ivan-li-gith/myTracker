"""add banks table and bank_id to money_transfers

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'l2m3n4o5p6q7'
down_revision: Union[str, Sequence[str], None] = 'k1l2m3n4o5p6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'banks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.Text(), nullable=False),
    )
    op.add_column(
        'money_transfers',
        sa.Column('bank_id', sa.Integer(), sa.ForeignKey('banks.id', ondelete='SET NULL'), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('money_transfers', 'bank_id')
    op.drop_table('banks')
