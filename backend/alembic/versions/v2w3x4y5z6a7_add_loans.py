"""add loans table

Revision ID: v2w3x4y5z6a7
Revises: u1v2w3x4y5z6
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v2w3x4y5z6a7'
down_revision: Union[str, Sequence[str], None] = 'u1v2w3x4y5z6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'loans',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('disbursement_date', sa.Date(), nullable=False),
        sa.Column('original_principal', sa.Numeric(12, 2), nullable=False),
        sa.Column('unpaid_principal', sa.Numeric(12, 2), nullable=False),
        sa.Column('interest_rate', sa.Numeric(6, 4), nullable=False),
        sa.Column('unpaid_interest', sa.Numeric(12, 2), nullable=False),
        sa.Column('total_interest_paid', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('loans')
