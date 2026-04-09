import calendar
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.expenses import Expense
from app.schemas.expenses import (
    CategoryTotal,
    ExpenseCreate,
    ExpenseRead,
    ExpenseSummary,
    ExpenseUpdate,
)

router = APIRouter(prefix="/expenses", tags=["expenses"])


def _current_month() -> str:
    today = date.today()
    return f"{today.year}-{today.month:02d}"


def _month_range(month: str) -> tuple[date, date]:
    year, mon = map(int, month.split("-"))
    last_day = calendar.monthrange(year, mon)[1]
    return date(year, mon, 1), date(year, mon, last_day)


@router.get("/summary", response_model=ExpenseSummary)
async def get_summary(
    month: Optional[str] = None,
    session: AsyncSession = Depends(get_db_session),
):
    if month is None:
        month = _current_month()
    start, end = _month_range(month)

    totals = await session.execute(
        select(func.sum(Expense.amount), func.count(Expense.id))
        .where(Expense.date >= start, Expense.date <= end)
    )
    total_amt, count = totals.one()

    cats = await session.execute(
        select(Expense.category_id, func.sum(Expense.amount).label("total"))
        .where(Expense.date >= start, Expense.date <= end)
        .group_by(Expense.category_id)
        .order_by(func.sum(Expense.amount).desc())
    )
    by_category = [CategoryTotal(category_id=r[0], total=r[1]) for r in cats.all()]

    return ExpenseSummary(
        month=month,
        total=total_amt or Decimal(0),
        count=count or 0,
        by_category=by_category,
    )


@router.get("", response_model=list[ExpenseRead])
async def list_expenses(
    month: Optional[str] = None,
    session: AsyncSession = Depends(get_db_session),
):
    query = select(Expense)
    if month is not None:
        start, end = _month_range(month)
        query = query.where(Expense.date >= start, Expense.date <= end)
    result = await session.execute(query.order_by(Expense.date.desc()))
    return result.scalars().all()


@router.post("", response_model=ExpenseRead, status_code=201)
async def create_expense(body: ExpenseCreate, session: AsyncSession = Depends(get_db_session)):
    expense = Expense(**body.model_dump())
    session.add(expense)
    await session.commit()
    await session.refresh(expense)
    return expense


@router.patch("/{expense_id}", response_model=ExpenseRead)
async def update_expense(
    expense_id: int,
    body: ExpenseUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(expense, key, value)
    await session.commit()
    await session.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(expense_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    await session.delete(expense)
    await session.commit()
