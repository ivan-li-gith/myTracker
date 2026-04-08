import pytest
from datetime import date
from app.database import sessionmanager
from app.models.tasks import Task

async def test_create_and_read_task():
    async with sessionmanager.session() as session:
        # 1. Create a task and insert it
        task = Task(name="Smoke test task", due_date=date(2026, 4, 10))
        session.add(task)
        await session.commit()

        # 2. Refresh to get DB-generated fields (id, created_at)
        await session.refresh(task)

        # 3. Assert the fields round-trip correctly
        assert task.id is not None          # DB assigned a PK
        assert task.name == "Smoke test task"
        assert task.due_date == date(2026, 4, 10)
        assert task.completed is False       # default from the model

        # 4. Cleanup — delete the row so the test doesn't leave residue
        await session.delete(task)
        await session.commit()