from app.database import Base
from sqlalchemy import Text, Numeric, ForeignKey, Integer, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from decimal import Decimal
from typing import Optional
import datetime


class RecurringCharge(Base):
    __tablename__ = "recurring_charges"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    charge_date: Mapped[int] = mapped_column(Integer)  # day of month 1-31
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    credit_card_id: Mapped[Optional[int]] = mapped_column(ForeignKey("credit_cards.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    split_with: Mapped[Optional[str]] = mapped_column(Text)
    price_history: Mapped[list["RecurringChargePriceHistory"]] = relationship(
        "RecurringChargePriceHistory",
        back_populates="charge",
        cascade="all, delete-orphan",
    )
    cancellation_periods: Mapped[list["RecurringChargeCancellationPeriod"]] = relationship(
        "RecurringChargeCancellationPeriod",
        back_populates="charge",
        cascade="all, delete-orphan",
    )


class RecurringChargePriceHistory(Base):
    __tablename__ = "recurring_charge_price_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    recurring_charge_id: Mapped[int] = mapped_column(ForeignKey("recurring_charges.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    effective_from: Mapped[datetime.date] = mapped_column(Date)  # always the 1st of a month
    charge: Mapped["RecurringCharge"] = relationship("RecurringCharge", back_populates="price_history")


class RecurringChargeCancellationPeriod(Base):
    __tablename__ = "recurring_charge_cancellation_periods"

    id: Mapped[int] = mapped_column(primary_key=True)
    recurring_charge_id: Mapped[int] = mapped_column(ForeignKey("recurring_charges.id"))
    canceled_from: Mapped[datetime.date] = mapped_column(Date)      # first day of month canceled
    reactivated_from: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)  # first day of month reactivated; null = still canceled
    charge: Mapped["RecurringCharge"] = relationship("RecurringCharge", back_populates="cancellation_periods")
