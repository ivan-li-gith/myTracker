from pydantic import BaseModel, ConfigDict


class PersonCreate(BaseModel):
    name: str


class PersonRead(PersonCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)
