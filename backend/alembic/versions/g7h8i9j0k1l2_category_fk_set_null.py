"""alter category FK constraints to SET NULL on delete

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'g7h8i9j0k1l2'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # expenses.category_id
    op.drop_constraint('expenses_category_id_fkey', 'expenses', type_='foreignkey')
    op.create_foreign_key(
        'expenses_category_id_fkey',
        'expenses', 'categories',
        ['category_id'], ['id'],
        ondelete='SET NULL',
    )

    # recurring_charges.category_id
    op.drop_constraint('recurring_charges_category_id_fkey', 'recurring_charges', type_='foreignkey')
    op.create_foreign_key(
        'recurring_charges_category_id_fkey',
        'recurring_charges', 'categories',
        ['category_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('recurring_charges_category_id_fkey', 'recurring_charges', type_='foreignkey')
    op.create_foreign_key(
        'recurring_charges_category_id_fkey',
        'recurring_charges', 'categories',
        ['category_id'], ['id'],
    )

    op.drop_constraint('expenses_category_id_fkey', 'expenses', type_='foreignkey')
    op.create_foreign_key(
        'expenses_category_id_fkey',
        'expenses', 'categories',
        ['category_id'], ['id'],
    )
