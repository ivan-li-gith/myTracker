from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.work_log import WorkLogEntry
from app.schemas.work_log import WorkLogEntryCreate, WorkLogEntryRead, WorkLogEntryUpdate

router = APIRouter(prefix="/work-log", tags=["work-log"])


@router.get("", response_model=list[WorkLogEntryRead])
async def list_entries(
    date: date,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(
        select(WorkLogEntry)
        .where(WorkLogEntry.date == date)
        .order_by(WorkLogEntry.start_time)
    )
    return result.scalars().all()


@router.post("", response_model=WorkLogEntryRead, status_code=201)
async def create_entry(body: WorkLogEntryCreate, session: AsyncSession = Depends(get_db_session)):
    entry = WorkLogEntry(**body.model_dump())
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=WorkLogEntryRead)
async def update_entry(
    entry_id: int,
    body: WorkLogEntryUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(WorkLogEntry).where(WorkLogEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    await session.commit()
    await session.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
async def delete_entry(entry_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(WorkLogEntry).where(WorkLogEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    await session.delete(entry)
    await session.commit()
