from datetime import datetime, timezone, date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.habits import Habit, HabitLog
from app.schemas.habits import HabitCreate, HabitLogRead, HabitRead, HabitUpdate, HabitWithStreak, LogCreate
from app.services.habits import compute_streak

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("", response_model=list[HabitWithStreak])
async def list_habits(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Habit).where(Habit.archived == False))
    habits = result.scalars().all()

    habit_list = []
    for habit in habits:
        logs_result = await session.execute(
            select(HabitLog.logged_at).where(HabitLog.habit_id == habit.id)
        )
        log_times = logs_result.scalars().all()
        streak = compute_streak(log_times, habit.target_freq)
        logged_dates = list({lt.date().isoformat() for lt in log_times})
        habit_list.append(
            HabitWithStreak(
                **HabitRead.model_validate(habit).model_dump(),
                streak=streak,
                logged_dates=logged_dates,
            )
        )

    return habit_list


@router.post("", response_model=HabitRead, status_code=201)
async def create_habit(body: HabitCreate, session: AsyncSession = Depends(get_db_session)):
    habit = Habit(**body.model_dump())
    session.add(habit)
    await session.commit()
    await session.refresh(habit)
    return habit


@router.post("/{habit_id}/log", response_model=HabitLogRead, status_code=201)
async def log_habit(
    habit_id: int,
    body: Optional[LogCreate] = None,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(Habit).where(Habit.id == habit_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    logged_at = (body.logged_at if body and body.logged_at else None) or datetime.now(timezone.utc)
    log = HabitLog(habit_id=habit_id, logged_at=logged_at)
    session.add(log)
    await session.commit()
    await session.refresh(log)
    return log


@router.delete("/{habit_id}/log", status_code=204)
async def delete_log(
    habit_id: int,
    log_date: str = Query(..., description="ISO date (YYYY-MM-DD) of the log to remove"),
    session: AsyncSession = Depends(get_db_session),
):
    target = date_type.fromisoformat(log_date)
    day_start = datetime(target.year, target.month, target.day, 0, 0, 0, tzinfo=timezone.utc)
    day_end = datetime(target.year, target.month, target.day, 23, 59, 59, tzinfo=timezone.utc)

    result = await session.execute(
        select(HabitLog)
        .where(HabitLog.habit_id == habit_id)
        .where(HabitLog.logged_at >= day_start)
        .where(HabitLog.logged_at <= day_end)
        .order_by(HabitLog.logged_at.desc())
        .limit(1)
    )
    log = result.scalar_one_or_none()
    if log:
        await session.delete(log)
        await session.commit()


@router.patch("/{habit_id}", response_model=HabitRead)
async def update_habit(habit_id: int, body: HabitUpdate, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Habit).where(Habit.id == habit_id))
    habit = result.scalar_one_or_none()
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(habit, field, value)
    await session.commit()
    await session.refresh(habit)
    return habit


@router.delete("/{habit_id}", status_code=204)
async def delete_habit(habit_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Habit).where(Habit.id == habit_id))
    habit = result.scalar_one_or_none()
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    await session.execute(delete(HabitLog).where(HabitLog.habit_id == habit_id))
    await session.delete(habit)
    await session.commit()
