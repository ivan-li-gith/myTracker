"""add recurring fields and price history to utility_bills

Revision ID: u1v2w3x4y5z6
Revises: t0u1v2w3x4y5
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'u1v2w3x4y5z6'
down_revision: Union[str, Sequence[str], None] = 't0u1v2w3x4y5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('utility_bills', sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('utility_bills', sa.Column('charge_day', sa.Integer(), nullable=True))
    op.add_column('utility_bills', sa.Column('billing_start', sa.Date(), nullable=True))
    # Make one-time fields nullable (they were NOT NULL before)
    op.alter_column('utility_bills', 'service_period_start', nullable=True)
    op.alter_column('utility_bills', 'service_period_end', nullable=True)
    op.alter_column('utility_bills', 'charge_date', nullable=True)
    op.create_table(
        'utility_bill_price_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('utility_bill_id', sa.Integer(), sa.ForeignKey('utility_bills.id'), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('effective_from', sa.Date(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('utility_bill_price_history')
    op.alter_column('utility_bills', 'charge_date', nullable=False)
    op.alter_column('utility_bills', 'service_period_end', nullable=False)
    op.alter_column('utility_bills', 'service_period_start', nullable=False)
    op.drop_column('utility_bills', 'billing_start')
    op.drop_column('utility_bills', 'charge_day')
    op.drop_column('utility_bills', 'is_recurring')
