from app.database import Base
from sqlalchemy import Text, Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date
from decimal import Decimal
from typing import Optional


class Bank(Base):
    __tablename__ = "banks"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    account_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # 'checking' | 'savings'
    starting_balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    starting_balance_as_of: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
