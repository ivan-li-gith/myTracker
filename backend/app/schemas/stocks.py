from pydantic import BaseModel, ConfigDict, computed_field
from datetime import datetime, date
from decimal import Decimal
from typing import Optional


class StockLotCreate(BaseModel):
    shares: Decimal
    buy_price: Decimal
    purchased_at: Optional[date] = None
    notes: Optional[str] = None


class StockLotRead(StockLotCreate):
    id: int
    stock_holding_id: int
    sold_price: Optional[Decimal] = None
    sold_at: Optional[date] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class StockLotUpdate(BaseModel):
    shares: Optional[Decimal] = None
    buy_price: Optional[Decimal] = None
    purchased_at: Optional[date] = None
    sold_price: Optional[Decimal] = None
    sold_at: Optional[date] = None
    notes: Optional[str] = None


class StockLotsSellBody(BaseModel):
    lot_ids: list[int]
    sold_price: Decimal
    sold_at: Optional[date] = None


class StockDividendCreate(BaseModel):
    paid_at: date
    dividend_per_share: Decimal
    shares_held: Decimal
    reinvested: bool = False
    notes: Optional[str] = None


class StockDividendRead(StockDividendCreate):
    id: int
    stock_holding_id: int
    created_at: datetime

    @computed_field
    @property
    def total_received(self) -> Decimal:
        return (self.dividend_per_share * self.shares_held).quantize(Decimal("0.01"))

    model_config = ConfigDict(from_attributes=True)


class StockDividendUpdate(BaseModel):
    paid_at: Optional[date] = None
    dividend_per_share: Optional[Decimal] = None
    shares_held: Optional[Decimal] = None
    reinvested: Optional[bool] = None
    notes: Optional[str] = None


class StockHoldingCreate(BaseModel):
    ticker: str
    company_name: Optional[str] = None
    notes: Optional[str] = None
    shares: Decimal
    buy_price: Decimal
    purchased_at: Optional[date] = None


class StockHoldingUpdate(BaseModel):
    ticker: Optional[str] = None
    company_name: Optional[str] = None
    current_price: Optional[Decimal] = None
    notes: Optional[str] = None


class StockHoldingRead(BaseModel):
    id: int
    ticker: str
    company_name: Optional[str] = None
    current_price: Decimal
    notes: Optional[str] = None
    created_at: datetime
    lots: list[StockLotRead] = []
    dividends: list[StockDividendRead] = []

    @computed_field
    @property
    def shares(self) -> Decimal:
        return sum((lot.shares for lot in self.lots if lot.sold_price is None), Decimal("0"))

    @computed_field
    @property
    def buy_price(self) -> Decimal:
        active = [lot for lot in self.lots if lot.sold_price is None]
        total_shares = sum(lot.shares for lot in active)
        if not total_shares:
            return Decimal("0")
        total_cost = sum(lot.shares * lot.buy_price for lot in active)
        return (total_cost / total_shares).quantize(Decimal("0.0001"))

    @computed_field
    @property
    def realized_gain(self) -> Decimal:
        return sum(
            (lot.sold_price - lot.buy_price) * lot.shares
            for lot in self.lots
            if lot.sold_price is not None
        )

    @computed_field
    @property
    def total_dividends(self) -> Decimal:
        return sum(
            (d.dividend_per_share * d.shares_held for d in self.dividends),
            Decimal("0"),
        ).quantize(Decimal("0.01"))

    model_config = ConfigDict(from_attributes=True)
