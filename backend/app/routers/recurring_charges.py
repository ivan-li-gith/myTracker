from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import datetime

from app.database import get_db_session
from app.models.recurring_charges import (
    RecurringCharge,
    RecurringChargePriceHistory,
    RecurringChargeCancellationPeriod,
)
from app.schemas.recurring_charges import (
    RecurringChargeCreate,
    RecurringChargeRead,
    RecurringChargeUpdate,
    PriceHistoryCreate,
    PriceHistoryEntry,
    CancellationPeriod,
    CancelCreate,
    ReactivateCreate,
)

router = APIRouter(prefix="/recurring-charges", tags=["recurring-charges"])


async def _load_charge(session: AsyncSession, charge_id: int) -> RecurringCharge:
    result = await session.execute(
        select(RecurringCharge)
        .options(
            selectinload(RecurringCharge.price_history),
            selectinload(RecurringCharge.cancellation_periods),
        )
        .where(RecurringCharge.id == charge_id)
    )
    charge = result.scalar_one_or_none()
    if charge is None:
        raise HTTPException(status_code=404, detail="Recurring charge not found")
    return charge


@router.get("", response_model=list[RecurringChargeRead])
async def list_recurring_charges(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(
        select(RecurringCharge)
        .options(
            selectinload(RecurringCharge.price_history),
            selectinload(RecurringCharge.cancellation_periods),
        )
        .order_by(RecurringCharge.charge_date)
    )
    return result.scalars().all()


@router.post("", response_model=RecurringChargeRead, status_code=201)
async def create_recurring_charge(
    body: RecurringChargeCreate,
    session: AsyncSession = Depends(get_db_session),
):
    charge = RecurringCharge(**body.model_dump())
    session.add(charge)
    await session.flush()
    charge_id = charge.id
    await session.commit()
    return await _load_charge(session, charge_id)


@router.patch("/{charge_id}", response_model=RecurringChargeRead)
async def update_recurring_charge(
    charge_id: int,
    body: RecurringChargeUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    charge = await _load_charge(session, charge_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(charge, key, value)
    await session.commit()
    return await _load_charge(session, charge_id)


@router.delete("/{charge_id}", status_code=204)
async def delete_recurring_charge(
    charge_id: int,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(RecurringCharge).where(RecurringCharge.id == charge_id))
    charge = result.scalar_one_or_none()
    if charge is None:
        raise HTTPException(status_code=404, detail="Recurring charge not found")
    await session.delete(charge)
    await session.commit()


@router.post("/{charge_id}/cancel", response_model=CancellationPeriod, status_code=201)
async def cancel_recurring_charge(
    charge_id: int,
    body: CancelCreate,
    session: AsyncSession = Depends(get_db_session),
):
    charge = await _load_charge(session, charge_id)
    period = RecurringChargeCancellationPeriod(
        recurring_charge_id=charge_id,
        canceled_from=body.canceled_from,
        reactivated_from=None,
    )
    session.add(period)
    await session.flush()
    period_id = period.id
    await session.commit()
    result = await session.execute(
        select(RecurringChargeCancellationPeriod).where(RecurringChargeCancellationPeriod.id == period_id)
    )
    return result.scalar_one()


@router.post("/{charge_id}/reactivate", response_model=CancellationPeriod)
async def reactivate_recurring_charge(
    charge_id: int,
    body: ReactivateCreate,
    session: AsyncSession = Depends(get_db_session),
):
    charge = await _load_charge(session, charge_id)
    # Find the most recent open cancellation period (no reactivated_from)
    open_period = next(
        (p for p in sorted(charge.cancellation_periods, key=lambda p: p.canceled_from, reverse=True)
         if p.reactivated_from is None),
        None,
    )
    if open_period is None:
        raise HTTPException(status_code=404, detail="No open cancellation period found")
    open_period.reactivated_from = body.reactivated_from
    period_id = open_period.id  # capture before commit expires the instance
    await session.commit()
    result = await session.execute(
        select(RecurringChargeCancellationPeriod).where(RecurringChargeCancellationPeriod.id == period_id)
    )
    return result.scalar_one()


@router.post("/{charge_id}/price-history", response_model=PriceHistoryEntry, status_code=201)
async def add_price_history(
    charge_id: int,
    body: PriceHistoryCreate,
    session: AsyncSession = Depends(get_db_session),
):
    charge = await _load_charge(session, charge_id)

    if not charge.price_history:
        origin = RecurringChargePriceHistory(
            recurring_charge_id=charge_id,
            amount=charge.amount,
            effective_from=datetime.date(2000, 1, 1),
        )
        session.add(origin)

    latest = max((h.effective_from for h in charge.price_history), default=None)

    entry = RecurringChargePriceHistory(
        recurring_charge_id=charge_id,
        amount=body.amount,
        effective_from=body.effective_from,
    )
    session.add(entry)

    if latest is None or body.effective_from >= latest:
        charge.amount = body.amount

    await session.flush()
    entry_id = entry.id
    await session.commit()
    result = await session.execute(
        select(RecurringChargePriceHistory).where(RecurringChargePriceHistory.id == entry_id)
    )
    return result.scalar_one()


@router.delete("/{charge_id}/price-history/{entry_id}", status_code=204)
async def delete_price_history(
    charge_id: int,
    entry_id: int,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(
        select(RecurringChargePriceHistory).where(
            RecurringChargePriceHistory.id == entry_id,
            RecurringChargePriceHistory.recurring_charge_id == charge_id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Price history entry not found")
    await session.delete(entry)

    charge = await _load_charge(session, charge_id)
    remaining = [h for h in charge.price_history if h.id != entry_id]
    if remaining:
        charge.amount = max(remaining, key=lambda h: h.effective_from).amount

    await session.commit()
