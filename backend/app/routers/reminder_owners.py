from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.reminder_owners import ReminderOwner
from app.schemas.reminder_owners import ReminderOwnerCreate, ReminderOwnerRead

router = APIRouter(tags=["reminder_owners"])


@router.get("/reminder-owners", response_model=list[ReminderOwnerRead])
async def list_owners(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(ReminderOwner).order_by(ReminderOwner.name.asc()))
    return result.scalars().all()


@router.post("/reminder-owners", response_model=ReminderOwnerRead, status_code=201)
async def create_owner(body: ReminderOwnerCreate, session: AsyncSession = Depends(get_db_session)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be empty")
    existing = await session.execute(select(ReminderOwner).where(ReminderOwner.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Owner already exists")
    owner = ReminderOwner(name=name)
    session.add(owner)
    await session.commit()
    await session.refresh(owner)
    return owner


@router.delete("/reminder-owners/{owner_id}", status_code=204)
async def delete_owner(owner_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(ReminderOwner).where(ReminderOwner.id == owner_id))
    owner = result.scalar_one_or_none()
    if owner is None:
        raise HTTPException(status_code=404, detail="Owner not found")
    await session.delete(owner)
    await session.commit()
