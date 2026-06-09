from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.credit_card_reminders import CreditCardReminder
from app.schemas.credit_card_reminders import CreditCardReminderCreate, CreditCardReminderRead, CreditCardReminderUpdate

router = APIRouter(tags=["credit_card_reminders"])


async def _get(session: AsyncSession, reminder_id: int) -> CreditCardReminder:
    result = await session.execute(select(CreditCardReminder).where(CreditCardReminder.id == reminder_id))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="Credit card reminder not found")
    return obj


@router.get("/credit-card-reminders", response_model=list[CreditCardReminderRead])
async def list_reminders(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(
        select(CreditCardReminder).order_by(text("position ASC NULLS LAST"), CreditCardReminder.due_day.asc(), CreditCardReminder.created_at.asc())
    )
    return result.scalars().all()


@router.put("/credit-card-reminders/reorder", status_code=204)
async def reorder_reminders(body: list[int], session: AsyncSession = Depends(get_db_session)):
    for position, reminder_id in enumerate(body):
        result = await session.execute(select(CreditCardReminder).where(CreditCardReminder.id == reminder_id))
        obj = result.scalar_one_or_none()
        if obj:
            obj.position = position
    await session.commit()


@router.post("/credit-card-reminders", response_model=CreditCardReminderRead, status_code=201)
async def create_reminder(body: CreditCardReminderCreate, session: AsyncSession = Depends(get_db_session)):
    obj = CreditCardReminder(**body.model_dump())
    session.add(obj)
    await session.flush()
    obj_id = obj.id
    await session.commit()
    return await _get(session, obj_id)


@router.patch("/credit-card-reminders/{reminder_id}", response_model=CreditCardReminderRead)
async def update_reminder(reminder_id: int, body: CreditCardReminderUpdate, session: AsyncSession = Depends(get_db_session)):
    obj = await _get(session, reminder_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await session.commit()
    return await _get(session, reminder_id)


@router.delete("/credit-card-reminders/{reminder_id}", status_code=204)
async def delete_reminder(reminder_id: int, session: AsyncSession = Depends(get_db_session)):
    obj = await _get(session, reminder_id)
    await session.delete(obj)
    await session.commit()
