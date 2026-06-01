from app.database import Base
from sqlalchemy import Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime


class ReminderOwner(Base):
    __tablename__ = "reminder_owners"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
