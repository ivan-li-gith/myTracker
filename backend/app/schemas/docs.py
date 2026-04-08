from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class DocBase(BaseModel):
    title: str
    category: Optional[str] = None
    content: Optional[str] = None
    is_favorite: bool = False

class DocCreate(DocBase):
    pass

class DocUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    is_favorite: Optional[bool] = None

class DocRead(DocBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
