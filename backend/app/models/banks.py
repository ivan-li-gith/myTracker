from app.database import Base
from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column


class Bank(Base):
    __tablename__ = "banks"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
