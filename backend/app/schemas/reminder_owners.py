from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ReminderOwnerCreate(BaseModel):
    name: str


class ReminderOwnerRead(ReminderOwnerCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
