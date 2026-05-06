from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from typing import Optional
import datetime


class PriceHistoryEntry(BaseModel):
    id: int
    recurring_charge_id: int
    amount: Decimal
    effective_from: datetime.date
    model_config = ConfigDict(from_attributes=True)


class PriceHistoryCreate(BaseModel):
    amount: Decimal
    effective_from: datetime.date  # always the 1st of a month


class CancellationPeriod(BaseModel):
    id: int
    recurring_charge_id: int
    canceled_from: datetime.date
    reactivated_from: Optional[datetime.date]
    model_config = ConfigDict(from_attributes=True)


class CancelCreate(BaseModel):
    canceled_from: datetime.date  # first day of the month to cancel from


class ReactivateCreate(BaseModel):
    reactivated_from: datetime.date  # first day of the month to reactivate from


class RecurringChargeBase(BaseModel):
    name: str
    amount: Decimal
    charge_date: int
    category_id: Optional[int] = None
    notes: Optional[str] = None


class RecurringChargeCreate(RecurringChargeBase):
    pass


class RecurringChargeUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    charge_date: Optional[int] = None
    category_id: Optional[int] = None
    notes: Optional[str] = None


class RecurringChargeRead(RecurringChargeBase):
    id: int
    price_history: list[PriceHistoryEntry] = []
    cancellation_periods: list[CancellationPeriod] = []
    model_config = ConfigDict(from_attributes=True)
