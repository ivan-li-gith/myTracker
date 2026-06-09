from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class HabitBase(BaseModel):
    name: str
    target_freq: Optional[int] = None
    archived: bool = False
    category: str = "standard"


class HabitCreate(HabitBase):
    created_at: Optional[datetime] = None


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    target_freq: Optional[int] = None
    archived: Optional[bool] = None
    category: Optional[str] = None
    deleted_at: Optional[datetime] = None


class HabitRead(HabitBase):
    id: int
    created_at: datetime
    deleted_at: Optional[datetime] = None
    position: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class HabitLogRead(BaseModel):
    id: int
    habit_id: int
    logged_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LogCreate(BaseModel):
    logged_at: Optional[datetime] = None


class HabitWithStreak(HabitRead):
    streak: int
    logged_dates: list[str]  # ISO date strings (YYYY-MM-DD) for all logged days
