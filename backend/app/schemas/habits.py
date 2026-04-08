from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class HabitBase(BaseModel):
    name: str
    target_freq: Optional[int] = None
    archived: bool = False


class HabitCreate(HabitBase):
    pass


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    target_freq: Optional[int] = None
    archived: Optional[bool] = None


class HabitRead(HabitBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HabitLogRead(BaseModel):
    id: int
    habit_id: int
    logged_at: datetime

    model_config = ConfigDict(from_attributes=True)
