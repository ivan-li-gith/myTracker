from app.database import Base
from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
