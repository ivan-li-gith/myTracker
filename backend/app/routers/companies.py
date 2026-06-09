from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.database import get_db_session
from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyRead

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=list[CompanyRead])
async def list_companies(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Company).order_by(Company.name))
    return result.scalars().all()


@router.post("", response_model=CompanyRead, status_code=201)
async def create_company(body: CompanyCreate, session: AsyncSession = Depends(get_db_session)):
    existing = await session.execute(select(Company).where(Company.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Company already exists")
    company = Company(name=body.name)
    session.add(company)
    await session.commit()
    await session.refresh(company)
    return company


@router.delete("/{company_id}", status_code=204)
async def delete_company(company_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    try:
        await session.delete(company)
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Cannot delete company with existing work log entries")
