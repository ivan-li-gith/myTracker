from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.people import Person
from app.schemas.people import PersonCreate, PersonRead

router = APIRouter(prefix="/people", tags=["people"])


@router.get("", response_model=list[PersonRead])
async def list_people(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Person).order_by(Person.name))
    return result.scalars().all()


@router.post("", response_model=PersonRead, status_code=201)
async def create_person(body: PersonCreate, session: AsyncSession = Depends(get_db_session)):
    existing = await session.execute(select(Person).where(Person.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Person already exists")
    person = Person(**body.model_dump())
    session.add(person)
    await session.commit()
    await session.refresh(person)
    return person


@router.delete("/{person_id}", status_code=204)
async def delete_person(person_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")
    await session.delete(person)
    await session.commit()
