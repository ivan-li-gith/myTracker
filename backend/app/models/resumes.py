from app.database import Base
from sqlalchemy import Text, DateTime, func, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    file_type: Mapped[str] = mapped_column(Text)  # "resume" or "cover_letter"
    filename: Mapped[str] = mapped_column(Text)
    content_type: Mapped[str] = mapped_column(Text)
    file_data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
