from app.database import Base
from sqlalchemy import Text, Date, DateTime, Numeric, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date, datetime
from decimal import Decimal
from typing import Optional


class MoneyTransfer(Base):
    __tablename__ = "money_transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    date: Mapped[date] = mapped_column(Date)
    direction: Mapped[str] = mapped_column(Text)  # 'sent' | 'received'
    person: Mapped[str] = mapped_column(Text)
    platform: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bank_id: Mapped[Optional[int]] = mapped_column(ForeignKey("banks.id", ondelete="SET NULL"), nullable=True)
    from_bank_id: Mapped[Optional[int]] = mapped_column(ForeignKey("banks.id", ondelete="SET NULL"), nullable=True)
    to_bank_id: Mapped[Optional[int]] = mapped_column(ForeignKey("banks.id", ondelete="SET NULL"), nullable=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    credit_card_id: Mapped[Optional[int]] = mapped_column(ForeignKey("credit_cards.id", ondelete="SET NULL"), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    split_with: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
