from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.tasks import Task
from app.schemas.tasks import TaskCreate, TaskRead, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskRead])
async def list_tasks(
    completed: Optional[bool] = None,
    session: AsyncSession = Depends(get_db_session),
):
    query = select(Task)
    if completed is not None:
        query = query.where(Task.completed == completed)
    result = await session.execute(query)
    return result.scalars().all()


@router.post("", response_model=TaskRead, status_code=201)
async def create_task(body: TaskCreate, session: AsyncSession = Depends(get_db_session)):
    task = Task(**body.model_dump())
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: int,
    body: TaskUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = body.model_dump(exclude_unset=True)

    if "completed" in update_data:
        if update_data["completed"] is True and task.completed_at is None:
            update_data["completed_at"] = datetime.now(timezone.utc)
        elif update_data["completed"] is False:
            update_data["completed_at"] = None

    for key, value in update_data.items():
        setattr(task, key, value)

    await session.commit()
    await session.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    await session.delete(task)
    await session.commit()
