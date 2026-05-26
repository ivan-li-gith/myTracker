from app.database import Base
from sqlalchemy import Text, Date, DateTime, Numeric, Integer, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date, datetime
from decimal import Decimal
from typing import Optional


class UtilityBill(Base):
    __tablename__ = "utility_bills"

    id: Mapped[int] = mapped_column(primary_key=True)
    utility: Mapped[str] = mapped_column(Text)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    # One-time bill fields
    service_period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    service_period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    charge_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # Recurring bill fields
    charge_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # day of month 1-31
    billing_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)  # first of a month
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    split_with: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price_history: Mapped[list["UtilityBillPriceHistory"]] = relationship(
        "UtilityBillPriceHistory",
        back_populates="bill",
        cascade="all, delete-orphan",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UtilityBillPriceHistory(Base):
    __tablename__ = "utility_bill_price_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    utility_bill_id: Mapped[int] = mapped_column(ForeignKey("utility_bills.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    effective_from: Mapped[date] = mapped_column(Date)  # always the 1st of a month
    bill: Mapped["UtilityBill"] = relationship("UtilityBill", back_populates="price_history")


class UtilityReimbursement(Base):
    __tablename__ = "utility_reimbursements"

    id: Mapped[int] = mapped_column(primary_key=True)
    person: Mapped[str] = mapped_column(Text)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    date: Mapped[date] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
