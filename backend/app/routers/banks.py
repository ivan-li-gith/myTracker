from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.banks import Bank
from app.schemas.banks import BankCreate, BankRead

router = APIRouter(prefix="/banks", tags=["banks"])


@router.get("", response_model=list[BankRead])
async def list_banks(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Bank).order_by(Bank.name))
    return result.scalars().all()


@router.post("", response_model=BankRead, status_code=201)
async def create_bank(body: BankCreate, session: AsyncSession = Depends(get_db_session)):
    bank = Bank(**body.model_dump())
    session.add(bank)
    await session.commit()
    await session.refresh(bank)
    return bank


@router.delete("/{bank_id}", status_code=204)
async def delete_bank(bank_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Bank).where(Bank.id == bank_id))
    bank = result.scalar_one_or_none()
    if bank is None:
        raise HTTPException(status_code=404, detail="Bank not found")
    await session.delete(bank)
    await session.commit()
