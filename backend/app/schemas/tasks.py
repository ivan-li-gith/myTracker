from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional


class TaskBase(BaseModel):
    name: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    completed: bool = False


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    completed: Optional[bool] = None


class TaskRead(TaskBase):
    id: int
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
