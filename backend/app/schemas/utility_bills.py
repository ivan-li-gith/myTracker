from pydantic import BaseModel, ConfigDict
from datetime import date as Date, datetime
from decimal import Decimal
from typing import Optional


class UtilityBillPriceHistoryEntry(BaseModel):
    id: int
    utility_bill_id: int
    amount: Decimal
    effective_from: Date
    model_config = ConfigDict(from_attributes=True)


class UtilityBillPriceHistoryCreate(BaseModel):
    amount: Decimal
    effective_from: Date


class UtilityBillCreate(BaseModel):
    utility: str
    is_recurring: bool = False
    service_period_start: Optional[Date] = None
    service_period_end: Optional[Date] = None
    charge_date: Optional[Date] = None
    charge_day: Optional[int] = None
    billing_start: Optional[Date] = None
    amount: Decimal
    split_with: Optional[str] = None
    notes: Optional[str] = None


class UtilityBillUpdate(BaseModel):
    utility: Optional[str] = None
    is_recurring: Optional[bool] = None
    service_period_start: Optional[Date] = None
    service_period_end: Optional[Date] = None
    charge_date: Optional[Date] = None
    charge_day: Optional[int] = None
    billing_start: Optional[Date] = None
    amount: Optional[Decimal] = None
    split_with: Optional[str] = None
    notes: Optional[str] = None


class UtilityBillRead(UtilityBillCreate):
    id: int
    price_history: list[UtilityBillPriceHistoryEntry] = []
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class UtilityReimbursementCreate(BaseModel):
    person: str
    amount: Decimal
    date: Date
    notes: Optional[str] = None


class UtilityReimbursementUpdate(BaseModel):
    person: Optional[str] = None
    amount: Optional[Decimal] = None
    date: Optional[Date] = None
    notes: Optional[str] = None


class UtilityReimbursementRead(UtilityReimbursementCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
