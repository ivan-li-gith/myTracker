from pydantic import BaseModel, ConfigDict
from datetime import datetime


class CompanyCreate(BaseModel):
    name: str


class CompanyRead(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
