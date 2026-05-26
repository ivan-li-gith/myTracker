from pydantic import BaseModel, ConfigDict
from datetime import date
from decimal import Decimal
from typing import Optional


class CreditCardCreate(BaseModel):
    name: str
    color: Optional[str] = None


class CreditCardUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class CreditCardRead(BaseModel):
    id: int
    name: str
    last_four: Optional[str] = None
    color: Optional[str] = None
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
