from pydantic import BaseModel, ConfigDict
from datetime import date as Date, datetime
from decimal import Decimal
from typing import Optional


class LoanCreate(BaseModel):
    name: str
    disbursement_date: Date
    original_principal: Decimal
    unpaid_principal: Decimal
    interest_rate: Decimal
    unpaid_interest: Decimal
    total_interest_paid: Decimal = Decimal("0")
    notes: Optional[str] = None


class LoanUpdate(BaseModel):
    name: Optional[str] = None
    disbursement_date: Optional[Date] = None
    original_principal: Optional[Decimal] = None
    unpaid_principal: Optional[Decimal] = None
    interest_rate: Optional[Decimal] = None
    unpaid_interest: Optional[Decimal] = None
    total_interest_paid: Optional[Decimal] = None
    notes: Optional[str] = None


class LoanRead(LoanCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
