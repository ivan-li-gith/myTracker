from app.database import Base
from sqlalchemy import Text, Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    last_four: Mapped[Optional[str]] = mapped_column(Text)
    color: Mapped[Optional[str]] = mapped_column(Text)
    billing_start_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    billing_end_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    due_date_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )


class CardStatement(Base):
    __tablename__ = "card_statements"

    id: Mapped[int] = mapped_column(primary_key=True)
    credit_card_id: Mapped[int] = mapped_column(
        ForeignKey("credit_cards.id", ondelete="CASCADE")
    )
    month: Mapped[str] = mapped_column(Text)  # YYYY-MM
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
