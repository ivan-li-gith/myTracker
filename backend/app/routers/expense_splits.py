from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.expenses import ExpenseSplit
from app.schemas.expenses import ExpenseSplitCreate, ExpenseSplitRead

router = APIRouter(prefix="/expense-splits", tags=["expense-splits"])


@router.get("", response_model=list[ExpenseSplitRead])
async def list_splits(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(
        select(ExpenseSplit).order_by(ExpenseSplit.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ExpenseSplitRead, status_code=201)
async def create_split(body: ExpenseSplitCreate, session: AsyncSession = Depends(get_db_session)):
    split = ExpenseSplit(**body.model_dump())
    session.add(split)
    await session.commit()
    await session.refresh(split)
    return split
