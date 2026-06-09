from app.database import Base
from sqlalchemy import Text, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional


class CreditCardReminder(Base):
    __tablename__ = "credit_card_reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_name: Mapped[str] = mapped_column(Text)
    owner: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_day: Mapped[int] = mapped_column(Integer)
    days_before: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
