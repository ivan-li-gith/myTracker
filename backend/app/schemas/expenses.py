from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

class ExpenseBase(BaseModel):
    name: str
    amount: Decimal
    date: date
    category_id: Optional[int] = None
    notes: Optional[str] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    date: Optional[date] = None
    category_id: Optional[int] = None
    notes: Optional[str] = None

class ExpenseRead(ExpenseBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ExpenseSplitBase(BaseModel):
    title: Optional[str] = None
    total: Optional[Decimal] = None
    participants: Optional[list[dict]] = None  

class ExpenseSplitCreate(ExpenseSplitBase):
    pass

class ExpenseSplitRead(ExpenseSplitBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
