from app.database import Base
from sqlalchemy import Text, Date, Boolean, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date
from decimal import Decimal
from typing import Optional


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    due_date: Mapped[date] = mapped_column(Date)
    recurrence: Mapped[Optional[str]] = mapped_column(Text) 
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"))
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
