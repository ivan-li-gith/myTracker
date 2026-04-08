from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class RecipeBase(BaseModel):
    title: str
    source_url: Optional[str] = None
    ingredients: Optional[str] = None
    steps: Optional[str] = None
    cook_time: Optional[str] = None
    category: Optional[str] = None
    is_favorite: bool = False


class RecipeCreate(RecipeBase):
    pass


class RecipeUpdate(BaseModel):
    title: Optional[str] = None
    source_url: Optional[str] = None
    ingredients: Optional[str] = None
    steps: Optional[str] = None
    cook_time: Optional[str] = None
    category: Optional[str] = None
    is_favorite: Optional[bool] = None


class RecipeRead(RecipeBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
