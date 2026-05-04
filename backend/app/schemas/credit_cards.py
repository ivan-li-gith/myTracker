from pydantic import BaseModel, ConfigDict
from typing import Optional


class CreditCardBase(BaseModel):
    name: str
    last_four: Optional[str] = None
    color: Optional[str] = None


class CreditCardCreate(CreditCardBase):
    pass


class CreditCardUpdate(BaseModel):
    name: Optional[str] = None
    last_four: Optional[str] = None
    color: Optional[str] = None


class CreditCardRead(CreditCardBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
