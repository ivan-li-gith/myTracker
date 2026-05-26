import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db_session
from app.models.utility_bills import UtilityBill, UtilityBillPriceHistory, UtilityReimbursement
from app.schemas.utility_bills import (
    UtilityBillCreate, UtilityBillRead, UtilityBillUpdate,
    UtilityBillPriceHistoryCreate, UtilityBillPriceHistoryEntry,
    UtilityReimbursementCreate, UtilityReimbursementRead, UtilityReimbursementUpdate,
)

router = APIRouter(tags=["utilities"])


async def _load_bill(session: AsyncSession, bill_id: int) -> UtilityBill:
    result = await session.execute(
        select(UtilityBill)
        .where(UtilityBill.id == bill_id)
        .options(selectinload(UtilityBill.price_history))
    )
    bill = result.scalar_one_or_none()
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


@router.get("/utility-bills", response_model=list[UtilityBillRead])
async def list_bills(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(
        select(UtilityBill)
        .options(selectinload(UtilityBill.price_history))
        .order_by(UtilityBill.charge_date.desc().nullslast(), UtilityBill.billing_start.desc().nullslast(), UtilityBill.created_at.desc())
    )
    return result.scalars().all()


@router.post("/utility-bills", response_model=UtilityBillRead, status_code=201)
async def create_bill(body: UtilityBillCreate, session: AsyncSession = Depends(get_db_session)):
    bill = UtilityBill(**body.model_dump())
    session.add(bill)
    await session.flush()
    bill_id = bill.id
    await session.commit()
    return await _load_bill(session, bill_id)


@router.patch("/utility-bills/{bill_id}", response_model=UtilityBillRead)
async def update_bill(bill_id: int, body: UtilityBillUpdate, session: AsyncSession = Depends(get_db_session)):
    bill = await _load_bill(session, bill_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(bill, key, value)
    await session.commit()
    return await _load_bill(session, bill_id)


@router.delete("/utility-bills/{bill_id}", status_code=204)
async def delete_bill(bill_id: int, session: AsyncSession = Depends(get_db_session)):
    bill = await _load_bill(session, bill_id)
    await session.delete(bill)
    await session.commit()


@router.post("/utility-bills/{bill_id}/price-history", response_model=UtilityBillPriceHistoryEntry, status_code=201)
async def add_price_history(bill_id: int, body: UtilityBillPriceHistoryCreate, session: AsyncSession = Depends(get_db_session)):
    bill = await _load_bill(session, bill_id)

    if not bill.price_history:
        origin = UtilityBillPriceHistory(
            utility_bill_id=bill_id,
            amount=bill.amount,
            effective_from=datetime.date(2000, 1, 1),
        )
        session.add(origin)

    latest = max((h.effective_from for h in bill.price_history), default=None)
    entry = UtilityBillPriceHistory(
        utility_bill_id=bill_id,
        amount=body.amount,
        effective_from=body.effective_from,
    )
    session.add(entry)

    if latest is None or body.effective_from >= latest:
        bill.amount = body.amount

    await session.flush()
    entry_id = entry.id
    await session.commit()
    result = await session.execute(select(UtilityBillPriceHistory).where(UtilityBillPriceHistory.id == entry_id))
    return result.scalar_one()


@router.delete("/utility-bills/{bill_id}/price-history/{entry_id}", status_code=204)
async def delete_price_history(bill_id: int, entry_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(
        select(UtilityBillPriceHistory).where(
            UtilityBillPriceHistory.id == entry_id,
            UtilityBillPriceHistory.utility_bill_id == bill_id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Price history entry not found")
    await session.delete(entry)
    bill = await _load_bill(session, bill_id)
    remaining = [h for h in bill.price_history if h.id != entry_id]
    if remaining:
        bill.amount = max(remaining, key=lambda h: h.effective_from).amount
    await session.commit()


@router.get("/utility-reimbursements", response_model=list[UtilityReimbursementRead])
async def list_reimbursements(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(
        select(UtilityReimbursement)
        .order_by(UtilityReimbursement.date.desc(), UtilityReimbursement.created_at.desc())
    )
    return result.scalars().all()


@router.post("/utility-reimbursements", response_model=UtilityReimbursementRead, status_code=201)
async def create_reimbursement(body: UtilityReimbursementCreate, session: AsyncSession = Depends(get_db_session)):
    reimb = UtilityReimbursement(**body.model_dump())
    session.add(reimb)
    await session.commit()
    await session.refresh(reimb)
    return reimb


@router.patch("/utility-reimbursements/{reimb_id}", response_model=UtilityReimbursementRead)
async def update_reimbursement(reimb_id: int, body: UtilityReimbursementUpdate, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(UtilityReimbursement).where(UtilityReimbursement.id == reimb_id))
    reimb = result.scalar_one_or_none()
    if reimb is None:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(reimb, key, value)
    await session.commit()
    await session.refresh(reimb)
    return reimb


@router.delete("/utility-reimbursements/{reimb_id}", status_code=204)
async def delete_reimbursement(reimb_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(UtilityReimbursement).where(UtilityReimbursement.id == reimb_id))
    reimb = result.scalar_one_or_none()
    if reimb is None:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    await session.delete(reimb)
    await session.commit()
