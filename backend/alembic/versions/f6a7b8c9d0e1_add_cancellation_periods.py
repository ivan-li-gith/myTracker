"""replace canceled_from scalar with cancellation_periods table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-05 03:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'recurring_charge_cancellation_periods',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recurring_charge_id', sa.Integer(), nullable=False),
        sa.Column('canceled_from', sa.Date(), nullable=False),
        sa.Column('reactivated_from', sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(
            ['recurring_charge_id'], ['recurring_charges.id'], ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    # Migrate any existing canceled_from values into the new table
    op.execute("""
        INSERT INTO recurring_charge_cancellation_periods
            (recurring_charge_id, canceled_from, reactivated_from)
        SELECT id, canceled_from, NULL
        FROM recurring_charges
        WHERE canceled_from IS NOT NULL
    """)
    op.drop_column('recurring_charges', 'canceled_from')


def downgrade() -> None:
    op.add_column(
        'recurring_charges',
        sa.Column('canceled_from', sa.Date(), nullable=True),
    )
    op.drop_table('recurring_charge_cancellation_periods')
