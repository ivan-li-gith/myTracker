"""squashed_schema

Revision ID: 1f0a29ec7447
Revises: 
Create Date: 2026-06-09 21:27:57.320494

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1f0a29ec7447'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from app.database import Base
    bind = op.get_bind()
    Base.metadata.create_all(bind, checkfirst=True)


def downgrade() -> None:
    from app.database import Base
    bind = op.get_bind()
    Base.metadata.drop_all(bind)
