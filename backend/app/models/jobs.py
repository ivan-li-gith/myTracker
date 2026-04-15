from app.database import Base
from sqlalchemy import Text, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date, datetime
from typing import Optional


class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    company: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text)
    url: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[Optional[str]] = mapped_column(Text)  
    date_applied: Mapped[Optional[date]] = mapped_column(Date)
    salary_range: Mapped[Optional[str]] = mapped_column(Text)
    location: Mapped[Optional[str]] = mapped_column(Text)
    job_type: Mapped[Optional[str]] = mapped_column(Text)
    salary_type: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    resume_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    cover_letter_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
