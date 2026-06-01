from app.database import Base
from sqlalchemy import Text, DateTime, Numeric, Date, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
from decimal import Decimal
from typing import Optional


class StockHolding(Base):
    __tablename__ = "stock_holdings"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker: Mapped[str] = mapped_column(Text)
    company_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    current_price: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    lots: Mapped[list["StockLot"]] = relationship(
        "StockLot", back_populates="holding", cascade="all, delete-orphan", lazy="selectin"
    )
    dividends: Mapped[list["StockDividend"]] = relationship(
        "StockDividend", back_populates="holding", cascade="all, delete-orphan", lazy="selectin",
        order_by="StockDividend.paid_at.desc()",
    )


class StockLot(Base):
    __tablename__ = "stock_lots"

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_holding_id: Mapped[int] = mapped_column(ForeignKey("stock_holdings.id", ondelete="CASCADE"))
    shares: Mapped[Decimal] = mapped_column(Numeric(14, 6))
    buy_price: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    purchased_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    sold_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    sold_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    holding: Mapped["StockHolding"] = relationship("StockHolding", back_populates="lots")


class StockDividend(Base):
    __tablename__ = "stock_dividends"

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_holding_id: Mapped[int] = mapped_column(ForeignKey("stock_holdings.id", ondelete="CASCADE"))
    paid_at: Mapped[date] = mapped_column(Date)
    dividend_per_share: Mapped[Decimal] = mapped_column(Numeric(12, 6))
    shares_held: Mapped[Decimal] = mapped_column(Numeric(14, 6))
    reinvested: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    holding: Mapped["StockHolding"] = relationship("StockHolding", back_populates="dividends")
