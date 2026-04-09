import calendar
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.payments import Payment
from app.schemas.payments import PaymentCreate, PaymentRead, PaymentReadWithDays, PaymentUpdate

router = APIRouter(prefix="/payments", tags=["payments"])


def _with_days(payment: Payment) -> PaymentReadWithDays:
    days = (payment.due_date - date.today()).days
    return PaymentReadWithDays(**PaymentRead.model_validate(payment).model_dump(), days_until_due=days)


def _bump_due_date(d: date, recurrence: str) -> date:
    if recurrence == "monthly":
        month = d.month % 12 + 1
        year = d.year + (d.month // 12)
        last_day = calendar.monthrange(year, month)[1]
        return d.replace(year=year, month=month, day=min(d.day, last_day))
    if recurrence == "yearly":
        try:
            return d.replace(year=d.year + 1)
        except ValueError:  # Feb 29 on non-leap year
            return d.replace(year=d.year + 1, day=28)
    return d


@router.get("", response_model=list[PaymentReadWithDays])
async def list_payments(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Payment).order_by(Payment.due_date.asc()))
    return [_with_days(p) for p in result.scalars().all()]


@router.post("", response_model=PaymentReadWithDays, status_code=201)
async def create_payment(body: PaymentCreate, session: AsyncSession = Depends(get_db_session)):
    payment = Payment(**body.model_dump())
    session.add(payment)
    await session.commit()
    await session.refresh(payment)
    return _with_days(payment)


@router.patch("/{payment_id}", response_model=PaymentReadWithDays)
async def update_payment(
    payment_id: int,
    body: PaymentUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(payment, key, value)
    await session.commit()
    await session.refresh(payment)
    return _with_days(payment)


@router.post("/{payment_id}/mark-paid", response_model=PaymentReadWithDays)
async def mark_paid(payment_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.recurrence in ("monthly", "yearly"):
        payment.due_date = _bump_due_date(payment.due_date, payment.recurrence)
        payment.is_paid = False
    else:
        payment.is_paid = True

    await session.commit()
    await session.refresh(payment)
    return _with_days(payment)


@router.delete("/{payment_id}", status_code=204)
async def delete_payment(payment_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    await session.delete(payment)
    await session.commit()
