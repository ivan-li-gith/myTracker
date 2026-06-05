from app.database import Base
from sqlalchemy import Text, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date, datetime
from typing import Optional


class WorkLogEntry(Base):
    __tablename__ = "work_log_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[str] = mapped_column(Text)
    end_time: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
