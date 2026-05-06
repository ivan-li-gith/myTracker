import calendar
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.credit_cards import CardStatement, CreditCard
from app.models.expenses import Expense
from app.schemas.credit_cards import (
    CardStatementRead,
    CardStatementUpdate,
    CreditCardCreate,
    CreditCardRead,
    CreditCardUpdate,
)

router = APIRouter(prefix="/credit-cards", tags=["credit-cards"])


def _clamp_day(year: int, month: int, day: int) -> date:
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last))


def _billing_dates(year: int, month: int, start_day: int, end_day: int, due_day: int):
    billing_end = _clamp_day(year, month, end_day)
    prev_year, prev_month = (year - 1, 12) if month == 1 else (year, month - 1)
    billing_start = _clamp_day(prev_year, prev_month, start_day)
    next_year, next_month = (year + 1, 1) if month == 12 else (year, month + 1)
    due_date = _clamp_day(next_year, next_month, due_day)
    return billing_start, billing_end, due_date


async def _sum_expenses(session: AsyncSession, card_id: int, start: date, end: date) -> Decimal:
    result = await session.execute(
        select(func.coalesce(func.sum(Expense.amount), 0))
        .where(Expense.credit_card_id == card_id)
        .where(Expense.date >= start)
        .where(Expense.date <= end)
    )
    return result.scalar()


# /statements must come before /{card_id} to avoid route shadowing
@router.get("/statements", response_model=list[CardStatementRead])
async def get_statements(
    month: str = Query(..., description="YYYY-MM"),
    session: AsyncSession = Depends(get_db_session),
):
    year, mon = int(month[:4]), int(month[5:])
    cards = (await session.execute(select(CreditCard).order_by(CreditCard.name))).scalars().all()
    existing = {
        s.credit_card_id: s
        for s in (await session.execute(
            select(CardStatement).where(CardStatement.month == month)
        )).scalars().all()
    }
    out = []
    for card in cards:
        if not (card.billing_start_day and card.billing_end_day and card.due_date_day):
            continue
        b_start, b_end, due = _billing_dates(year, mon, card.billing_start_day, card.billing_end_day, card.due_date_day)
        amount = await _sum_expenses(session, card.id, b_start, b_end)
        stmt = existing.get(card.id)
        out.append(CardStatementRead(
            statement_id=stmt.id if stmt else None,
            credit_card_id=card.id,
            month=month,
            billing_start=b_start,
            billing_end=b_end,
            due_date=due,
            amount=amount,
            is_paid=stmt.is_paid if stmt else False,
        ))
    return out


@router.get("", response_model=list[CreditCardRead])
async def list_credit_cards(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(CreditCard).order_by(CreditCard.name))
    return result.scalars().all()


@router.post("", response_model=CreditCardRead, status_code=201)
async def create_credit_card(body: CreditCardCreate, session: AsyncSession = Depends(get_db_session)):
    card = CreditCard(**body.model_dump())
    session.add(card)
    await session.commit()
    await session.refresh(card)
    return card


@router.patch("/{card_id}", response_model=CreditCardRead)
async def update_credit_card(
    card_id: int,
    body: CreditCardUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(CreditCard).where(CreditCard.id == card_id))
    card = result.scalar_one_or_none()
    if card is None:
        raise HTTPException(status_code=404, detail="Credit card not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(card, key, value)
    await session.commit()
    await session.refresh(card)
    return card


@router.patch("/{card_id}/statements/{month}", response_model=CardStatementRead)
async def update_statement(
    card_id: int,
    month: str,
    body: CardStatementUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    card = (await session.execute(select(CreditCard).where(CreditCard.id == card_id))).scalar_one_or_none()
    if card is None:
        raise HTTPException(status_code=404, detail="Credit card not found")
    if not (card.billing_start_day and card.billing_end_day and card.due_date_day):
        raise HTTPException(status_code=400, detail="Credit card billing cycle not configured")

    year, mon = int(month[:4]), int(month[5:])
    b_start, b_end, due = _billing_dates(year, mon, card.billing_start_day, card.billing_end_day, card.due_date_day)

    stmt = (await session.execute(
        select(CardStatement).where(CardStatement.credit_card_id == card_id, CardStatement.month == month)
    )).scalar_one_or_none()
    if stmt is None:
        stmt = CardStatement(credit_card_id=card_id, month=month)
        session.add(stmt)

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(stmt, key, value)

    await session.commit()
    await session.refresh(stmt)
    amount = await _sum_expenses(session, card_id, b_start, b_end)
    return CardStatementRead(
        statement_id=stmt.id,
        credit_card_id=card_id,
        month=month,
        billing_start=b_start,
        billing_end=b_end,
        due_date=due,
        amount=amount,
        is_paid=stmt.is_paid,
    )


@router.delete("/{card_id}", status_code=204)
async def delete_credit_card(card_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(CreditCard).where(CreditCard.id == card_id))
    card = result.scalar_one_or_none()
    if card is None:
        raise HTTPException(status_code=404, detail="Credit card not found")
    await session.delete(card)
    await session.commit()
