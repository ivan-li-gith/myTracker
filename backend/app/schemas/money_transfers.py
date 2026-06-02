from pydantic import BaseModel, ConfigDict
from datetime import date as Date, datetime
from decimal import Decimal
from typing import Optional


class MoneyTransferCreate(BaseModel):
    name: Optional[str] = None
    date: Date
    direction: str  # 'sent' | 'received'
    person: str
    platform: Optional[str] = None
    bank_id: Optional[int] = None
    from_bank_id: Optional[int] = None
    to_bank_id: Optional[int] = None
    category_id: Optional[int] = None
    credit_card_id: Optional[int] = None
    amount: Decimal
    notes: Optional[str] = None
    split_with: Optional[str] = None


class MoneyTransferUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[Date] = None
    direction: Optional[str] = None
    person: Optional[str] = None
    platform: Optional[str] = None
    bank_id: Optional[int] = None
    from_bank_id: Optional[int] = None
    to_bank_id: Optional[int] = None
    category_id: Optional[int] = None
    credit_card_id: Optional[int] = None
    amount: Optional[Decimal] = None
    notes: Optional[str] = None
    split_with: Optional[str] = None


class MoneyTransferRead(MoneyTransferCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
