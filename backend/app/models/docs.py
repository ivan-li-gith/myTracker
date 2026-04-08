from app.database import Base
from sqlalchemy import Text, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional


class Doc(Base):
    __tablename__ = "docs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(Text)
    content: Mapped[Optional[str]] = mapped_column(Text)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
