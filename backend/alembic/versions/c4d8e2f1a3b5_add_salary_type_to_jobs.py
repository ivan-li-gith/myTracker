"""add salary_type to job_applications

Revision ID: c4d8e2f1a3b5
Revises: b3c7f1d2e9a4
Create Date: 2026-04-14 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c4d8e2f1a3b5'
down_revision: Union[str, Sequence[str], None] = 'b3c7f1d2e9a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('job_applications', sa.Column('salary_type', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('job_applications', 'salary_type')
