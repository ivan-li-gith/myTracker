from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ResumeRead(BaseModel):
    id: int
    name: str
    file_type: str
    filename: str
    content_type: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
