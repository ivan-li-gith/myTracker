from pydantic import BaseModel, ConfigDict
from datetime import date
from decimal import Decimal
from typing import Optional


class CreditCardBase(BaseModel):
    name: str
    last_four: Optional[str] = None
    color: Optional[str] = None
    billing_start_day: Optional[int] = None
    billing_end_day: Optional[int] = None
    due_date_day: Optional[int] = None
    category_id: Optional[int] = None


class CreditCardCreate(CreditCardBase):
    pass


class CreditCardUpdate(BaseModel):
    name: Optional[str] = None
    last_four: Optional[str] = None
    color: Optional[str] = None
    billing_start_day: Optional[int] = None
    billing_end_day: Optional[int] = None
    due_date_day: Optional[int] = None
    category_id: Optional[int] = None


class CreditCardRead(CreditCardBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class CardStatementRead(BaseModel):
    statement_id: Optional[int]
    credit_card_id: int
    month: str
    billing_start: date
    billing_end: date
    due_date: date
    amount: Decimal
    is_paid: bool


class CardStatementUpdate(BaseModel):
    is_paid: Optional[bool] = None
