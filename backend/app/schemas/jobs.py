from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional

class JobApplicationBase(BaseModel):
    company: str
    role: str
    url:  Optional[str] = None
    status: Optional[str] = None
    date_applied: Optional[date] = None
    salary_range: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    notes: Optional[str] = None

class JobApplicationCreate(JobApplicationBase):
    pass

class JobApplicationUpdate(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    url: Optional[str] = None
    status: Optional[str] = None
    date_applied: Optional[date] = None
    salary_range: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    notes: Optional[str] = None

class JobApplicationRead(JobApplicationBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
