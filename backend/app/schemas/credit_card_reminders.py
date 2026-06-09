from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import Optional


class CreditCardReminderCreate(BaseModel):
    card_name: str
    owner: Optional[str] = None
    due_day: int
    days_before: Optional[int] = None

    @field_validator("due_day")
    @classmethod
    def validate_due_day(cls, v: int) -> int:
        if not 1 <= v <= 31:
            raise ValueError("due_day must be between 1 and 31")
        return v


class CreditCardReminderUpdate(BaseModel):
    card_name: Optional[str] = None
    owner: Optional[str] = None
    due_day: Optional[int] = None
    days_before: Optional[int] = None

    @field_validator("due_day")
    @classmethod
    def validate_due_day(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not 1 <= v <= 31:
            raise ValueError("due_day must be between 1 and 31")
        return v


class CreditCardReminderRead(CreditCardReminderCreate):
    id: int
    created_at: datetime
    position: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)
