from pydantic import BaseModel, ConfigDict
from datetime import date as Date
from decimal import Decimal
from typing import Optional


class BankCreate(BaseModel):
    name: str
    account_type: Optional[str] = None
    starting_balance: Optional[Decimal] = None
    starting_balance_as_of: Optional[Date] = None


class BankUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[str] = None
    starting_balance: Optional[Decimal] = None
    starting_balance_as_of: Optional[Date] = None


class BankRead(BankCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)
