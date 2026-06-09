from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional


class WorkLogEntryBase(BaseModel):
    company_id: int
    date: date
    start_time: str
    end_time: str
    category: str
    description: Optional[str] = None


class WorkLogEntryCreate(WorkLogEntryBase):
    pass


class WorkLogEntryUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None


class WorkLogEntryRead(WorkLogEntryBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
