from app.database import Base
from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    type: Mapped[Optional[str]] = mapped_column(Text)
