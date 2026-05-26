from pydantic import BaseModel, ConfigDict


class BankCreate(BaseModel):
    name: str


class BankRead(BankCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)
