from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.habits import Habit, HabitLog
from app.schemas.habits import HabitCreate, HabitLogRead, HabitRead, HabitWithStreak
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
        habit_list.append(
            HabitWithStreak(**HabitRead.model_validate(habit).model_dump(), streak=streak)
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
async def log_habit(habit_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Habit).where(Habit.id == habit_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    log = HabitLog(habit_id=habit_id)
    session.add(log)
    await session.commit()
    await session.refresh(log)
    return log


@router.delete("/{habit_id}", status_code=204)
async def delete_habit(habit_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Habit).where(Habit.id == habit_id))
    habit = result.scalar_one_or_none()
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")

    await session.execute(delete(HabitLog).where(HabitLog.habit_id == habit_id))
    await session.delete(habit)
    await session.commit()
