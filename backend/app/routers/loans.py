from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.loans import Loan
from app.schemas.loans import LoanCreate, LoanRead, LoanUpdate

router = APIRouter(tags=["loans"])


async def _get_loan(session: AsyncSession, loan_id: int) -> Loan:
    result = await session.execute(select(Loan).where(Loan.id == loan_id))
    loan = result.scalar_one_or_none()
    if loan is None:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


@router.get("/loans", response_model=list[LoanRead])
async def list_loans(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(
        select(Loan).order_by(Loan.disbursement_date.asc(), Loan.created_at.asc())
    )
    return result.scalars().all()


@router.post("/loans", response_model=LoanRead, status_code=201)
async def create_loan(body: LoanCreate, session: AsyncSession = Depends(get_db_session)):
    loan = Loan(**body.model_dump())
    session.add(loan)
    await session.flush()
    loan_id = loan.id
    await session.commit()
    return await _get_loan(session, loan_id)


@router.patch("/loans/{loan_id}", response_model=LoanRead)
async def update_loan(loan_id: int, body: LoanUpdate, session: AsyncSession = Depends(get_db_session)):
    loan = await _get_loan(session, loan_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(loan, key, value)
    await session.commit()
    return await _get_loan(session, loan_id)


@router.delete("/loans/{loan_id}", status_code=204)
async def delete_loan(loan_id: int, session: AsyncSession = Depends(get_db_session)):
    loan = await _get_loan(session, loan_id)
    await session.delete(loan)
    await session.commit()
