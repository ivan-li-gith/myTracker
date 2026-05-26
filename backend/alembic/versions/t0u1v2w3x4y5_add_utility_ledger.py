"""add utility_bills and utility_reimbursements tables

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 't0u1v2w3x4y5'
down_revision: Union[str, Sequence[str], None] = 's9t0u1v2w3x4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'utility_bills',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('utility', sa.Text(), nullable=False),
        sa.Column('service_period_start', sa.Date(), nullable=False),
        sa.Column('service_period_end', sa.Date(), nullable=False),
        sa.Column('charge_date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('split_with', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        'utility_reimbursements',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('person', sa.Text(), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('utility_reimbursements')
    op.drop_table('utility_bills')
