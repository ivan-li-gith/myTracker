from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.credit_cards import CreditCard
from app.schemas.credit_cards import CreditCardCreate, CreditCardRead, CreditCardUpdate

router = APIRouter(prefix="/credit-cards", tags=["credit-cards"])


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


@router.delete("/{card_id}", status_code=204)
async def delete_credit_card(card_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(CreditCard).where(CreditCard.id == card_id))
    card = result.scalar_one_or_none()
    if card is None:
        raise HTTPException(status_code=404, detail="Credit card not found")
    await session.delete(card)
    await session.commit()
