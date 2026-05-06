"""add billing days and category to credit_cards, create card_statements, fix expenses fk

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'i9j0k1l2m3n4'
down_revision: Union[str, Sequence[str], None] = 'h8i9j0k1l2m3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add billing cycle days and category to credit_cards
    op.add_column('credit_cards', sa.Column('billing_start_day', sa.Integer(), nullable=True))
    op.add_column('credit_cards', sa.Column('billing_end_day', sa.Integer(), nullable=True))
    op.add_column('credit_cards', sa.Column('due_date_day', sa.Integer(), nullable=True))
    op.add_column('credit_cards', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'credit_cards_category_id_fkey',
        'credit_cards', 'categories',
        ['category_id'], ['id'],
        ondelete='SET NULL',
    )

    # Fix expenses.credit_card_id FK to SET NULL on delete (was missing ondelete)
    op.drop_constraint('expenses_credit_card_id_fkey', 'expenses', type_='foreignkey')
    op.create_foreign_key(
        'expenses_credit_card_id_fkey',
        'expenses', 'credit_cards',
        ['credit_card_id'], ['id'],
        ondelete='SET NULL',
    )

    # Create card_statements table
    op.create_table(
        'card_statements',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('credit_card_id', sa.Integer(), nullable=False),
        sa.Column('month', sa.Text(), nullable=False),
        sa.Column('is_paid', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['credit_card_id'], ['credit_cards.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('credit_card_id', 'month', name='uq_card_statements_card_month'),
    )


def downgrade() -> None:
    op.drop_table('card_statements')
    op.drop_constraint('expenses_credit_card_id_fkey', 'expenses', type_='foreignkey')
    op.create_foreign_key(
        'expenses_credit_card_id_fkey',
        'expenses', 'credit_cards',
        ['credit_card_id'], ['id'],
    )
    op.drop_constraint('credit_cards_category_id_fkey', 'credit_cards', type_='foreignkey')
    op.drop_column('credit_cards', 'category_id')
    op.drop_column('credit_cards', 'due_date_day')
    op.drop_column('credit_cards', 'billing_end_day')
    op.drop_column('credit_cards', 'billing_start_day')
