from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.docs import Doc
from app.schemas.docs import DocCreate, DocRead, DocUpdate

router = APIRouter(prefix="/docs", tags=["docs"])


@router.get("", response_model=list[DocRead])
async def list_docs(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Doc).order_by(Doc.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=DocRead, status_code=201)
async def create_doc(body: DocCreate, session: AsyncSession = Depends(get_db_session)):
    doc = Doc(**body.model_dump())
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return doc


@router.patch("/{doc_id}", response_model=DocRead)
async def update_doc(
    doc_id: int,
    body: DocUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(Doc).where(Doc.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Doc not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(doc, key, value)
    await session.commit()
    await session.refresh(doc)
    return doc


@router.patch("/{doc_id}/favorite", response_model=DocRead)
async def toggle_favorite(doc_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Doc).where(Doc.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Doc not found")
    doc.is_favorite = not doc.is_favorite
    await session.commit()
    await session.refresh(doc)
    return doc


@router.delete("/{doc_id}", status_code=204)
async def delete_doc(doc_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Doc).where(Doc.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Doc not found")
    await session.delete(doc)
    await session.commit()
