import asyncio
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db_session
from app.models.stocks import StockHolding, StockLot, StockDividend
from app.schemas.stocks import (
    StockHoldingCreate, StockHoldingRead, StockHoldingUpdate,
    StockLotCreate, StockLotUpdate, StockLotsSellBody,
    StockDividendCreate, StockDividendRead, StockDividendUpdate,
)


def _fetch_price(ticker: str) -> float:
    import yfinance as yf
    fi = yf.Ticker(ticker).fast_info
    price = fi.last_price or fi.previous_close or fi.regular_market_previous_close or fi.open
    if not price:
        raise ValueError(f"No price found for ticker '{ticker}'. Check that the ticker symbol is correct.")
    return float(price)


router = APIRouter(tags=["stocks"])

_HOLDING_OPTIONS = [selectinload(StockHolding.lots), selectinload(StockHolding.dividends)]


async def _get_holding(session: AsyncSession, holding_id: int) -> StockHolding:
    result = await session.execute(
        select(StockHolding).options(*_HOLDING_OPTIONS).where(StockHolding.id == holding_id)
    )
    holding = result.scalar_one_or_none()
    if holding is None:
        raise HTTPException(status_code=404, detail="Stock holding not found")
    return holding


@router.get("/stocks", response_model=list[StockHoldingRead])
async def list_holdings(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(
        select(StockHolding).options(*_HOLDING_OPTIONS)
        .order_by(StockHolding.ticker.asc(), StockHolding.created_at.asc())
    )
    return result.scalars().all()


@router.post("/stocks", response_model=StockHoldingRead, status_code=201)
async def create_holding(body: StockHoldingCreate, session: AsyncSession = Depends(get_db_session)):
    ticker = body.ticker.upper()
    price = Decimal("0")
    try:
        price = Decimal(str(await asyncio.to_thread(_fetch_price, ticker)))
    except Exception:
        pass
    holding = StockHolding(
        ticker=ticker,
        company_name=body.company_name,
        current_price=price,
        notes=body.notes,
    )
    session.add(holding)
    await session.flush()
    holding_id = holding.id
    lot = StockLot(
        stock_holding_id=holding_id,
        shares=body.shares,
        buy_price=body.buy_price,
        purchased_at=body.purchased_at,
    )
    session.add(lot)
    await session.commit()
    return await _get_holding(session, holding_id)


@router.patch("/stocks/{holding_id}", response_model=StockHoldingRead)
async def update_holding(holding_id: int, body: StockHoldingUpdate, session: AsyncSession = Depends(get_db_session)):
    holding = await _get_holding(session, holding_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(holding, key, value)
    await session.commit()
    return await _get_holding(session, holding_id)


@router.delete("/stocks/{holding_id}", status_code=204)
async def delete_holding(holding_id: int, session: AsyncSession = Depends(get_db_session)):
    holding = await _get_holding(session, holding_id)
    await session.delete(holding)
    await session.commit()


@router.post("/stocks/{holding_id}/refresh-price", response_model=StockHoldingRead)
async def refresh_price(holding_id: int, session: AsyncSession = Depends(get_db_session)):
    holding = await _get_holding(session, holding_id)
    ticker = holding.ticker
    try:
        price = await asyncio.to_thread(_fetch_price, ticker)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    holding.current_price = price
    await session.commit()
    return await _get_holding(session, holding_id)


@router.post("/stocks/{holding_id}/lots", response_model=StockHoldingRead, status_code=201)
async def add_lot(holding_id: int, body: StockLotCreate, session: AsyncSession = Depends(get_db_session)):
    await _get_holding(session, holding_id)
    lot = StockLot(stock_holding_id=holding_id, **body.model_dump())
    session.add(lot)
    await session.commit()
    return await _get_holding(session, holding_id)


@router.patch("/stocks/lots/{lot_id}", response_model=StockHoldingRead)
async def update_lot(lot_id: int, body: StockLotUpdate, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(StockLot).where(StockLot.id == lot_id))
    lot = result.scalar_one_or_none()
    if lot is None:
        raise HTTPException(status_code=404, detail="Stock lot not found")
    holding_id = lot.stock_holding_id
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(lot, key, value)
    await session.commit()
    return await _get_holding(session, holding_id)


@router.post("/stocks/lots/sell", response_model=list[StockHoldingRead])
async def sell_lots(body: StockLotsSellBody, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(StockLot).where(StockLot.id.in_(body.lot_ids)))
    lots = result.scalars().all()
    if len(lots) != len(body.lot_ids):
        raise HTTPException(status_code=404, detail="One or more lots not found")
    holding_ids = {lot.stock_holding_id for lot in lots}
    for lot in lots:
        lot.sold_price = body.sold_price
        lot.sold_at = body.sold_at
    await session.commit()
    return [await _get_holding(session, hid) for hid in holding_ids]


@router.delete("/stocks/lots/{lot_id}", response_model=StockHoldingRead)
async def delete_lot(lot_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(StockLot).where(StockLot.id == lot_id))
    lot = result.scalar_one_or_none()
    if lot is None:
        raise HTTPException(status_code=404, detail="Stock lot not found")
    holding_id = lot.stock_holding_id
    holding = await _get_holding(session, holding_id)
    if len(holding.lots) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only lot. Delete the holding instead.")
    await session.delete(lot)
    await session.commit()
    return await _get_holding(session, holding_id)


# ---- Dividend endpoints ----

@router.post("/stocks/{holding_id}/dividends", response_model=StockHoldingRead, status_code=201)
async def add_dividend(holding_id: int, body: StockDividendCreate, session: AsyncSession = Depends(get_db_session)):
    await _get_holding(session, holding_id)
    dividend = StockDividend(stock_holding_id=holding_id, **body.model_dump())
    session.add(dividend)
    await session.commit()
    return await _get_holding(session, holding_id)


@router.patch("/stocks/dividends/{dividend_id}", response_model=StockHoldingRead)
async def update_dividend(dividend_id: int, body: StockDividendUpdate, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(StockDividend).where(StockDividend.id == dividend_id))
    dividend = result.scalar_one_or_none()
    if dividend is None:
        raise HTTPException(status_code=404, detail="Dividend not found")
    holding_id = dividend.stock_holding_id
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(dividend, key, value)
    await session.commit()
    return await _get_holding(session, holding_id)


@router.delete("/stocks/dividends/{dividend_id}", response_model=StockHoldingRead)
async def delete_dividend(dividend_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(StockDividend).where(StockDividend.id == dividend_id))
    dividend = result.scalar_one_or_none()
    if dividend is None:
        raise HTTPException(status_code=404, detail="Dividend not found")
    holding_id = dividend.stock_holding_id
    await session.delete(dividend)
    await session.commit()
    return await _get_holding(session, holding_id)
