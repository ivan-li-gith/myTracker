from app.database import Base
from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    last_four: Mapped[Optional[str]] = mapped_column(Text)
    color: Mapped[Optional[str]] = mapped_column(Text)
