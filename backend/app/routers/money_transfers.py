import calendar
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.money_transfers import MoneyTransfer
from app.schemas.money_transfers import MoneyTransferCreate, MoneyTransferRead, MoneyTransferUpdate

router = APIRouter(prefix="/money-transfers", tags=["money-transfers"])


def _month_range(month: str) -> tuple[date, date]:
    year, mon = map(int, month.split("-"))
    last_day = calendar.monthrange(year, mon)[1]
    return date(year, mon, 1), date(year, mon, last_day)


@router.get("", response_model=list[MoneyTransferRead])
async def list_transfers(
    month: Optional[str] = Query(None, description="YYYY-MM"),
    year: Optional[int] = Query(None),
    session: AsyncSession = Depends(get_db_session),
):
    query = select(MoneyTransfer)
    if month is not None:
        start, end = _month_range(month)
        query = query.where(MoneyTransfer.date >= start, MoneyTransfer.date <= end)
    elif year is not None:
        query = query.where(MoneyTransfer.date >= date(year, 1, 1), MoneyTransfer.date <= date(year, 12, 31))
    result = await session.execute(query.order_by(MoneyTransfer.date.desc(), MoneyTransfer.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=MoneyTransferRead, status_code=201)
async def create_transfer(body: MoneyTransferCreate, session: AsyncSession = Depends(get_db_session)):
    transfer = MoneyTransfer(**body.model_dump())
    session.add(transfer)
    await session.commit()
    await session.refresh(transfer)
    return transfer


@router.patch("/{transfer_id}", response_model=MoneyTransferRead)
async def update_transfer(
    transfer_id: int,
    body: MoneyTransferUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(MoneyTransfer).where(MoneyTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if transfer is None:
        raise HTTPException(status_code=404, detail="Transfer not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(transfer, key, value)
    await session.commit()
    await session.refresh(transfer)
    return transfer


@router.delete("/{transfer_id}", status_code=204)
async def delete_transfer(transfer_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(MoneyTransfer).where(MoneyTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if transfer is None:
        raise HTTPException(status_code=404, detail="Transfer not found")
    await session.delete(transfer)
    await session.commit()
