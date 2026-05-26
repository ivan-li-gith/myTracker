from app.database import Base
from sqlalchemy import Text, Date, DateTime, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date, datetime
from decimal import Decimal
from typing import Optional


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    disbursement_date: Mapped[date] = mapped_column(Date)
    original_principal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    unpaid_principal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4))
    unpaid_interest: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total_interest_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
