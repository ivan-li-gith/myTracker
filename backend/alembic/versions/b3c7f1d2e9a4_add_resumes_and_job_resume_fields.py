"""add resumes and job resume fields

Revision ID: b3c7f1d2e9a4
Revises: 0d3180ec317c
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3c7f1d2e9a4'
down_revision: Union[str, Sequence[str], None] = '0d3180ec317c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'resumes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('file_type', sa.Text(), nullable=False),
        sa.Column('filename', sa.Text(), nullable=False),
        sa.Column('content_type', sa.Text(), nullable=False),
        sa.Column('file_data', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('job_applications', sa.Column('resume_id', sa.Integer(), nullable=True))
    op.add_column('job_applications', sa.Column('cover_letter_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('job_applications', 'cover_letter_id')
    op.drop_column('job_applications', 'resume_id')
    op.drop_table('resumes')
