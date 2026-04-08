from pydantic import BaseModel, ConfigDict
from datetime import date
from decimal import Decimal
from typing import Optional


class PaymentBase(BaseModel):
    name: str
    amount: Optional[Decimal] = None
    due_date: date
    recurrence: Optional[str] = None  # 'monthly' | 'yearly' | 'one-time'
    category_id: Optional[int] = None
    is_paid: bool = False
    notes: Optional[str] = None


class PaymentCreate(PaymentBase):
    pass


class PaymentUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    due_date: Optional[date] = None
    recurrence: Optional[str] = None
    category_id: Optional[int] = None
    is_paid: Optional[bool] = None
    notes: Optional[str] = None


class PaymentRead(PaymentBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
