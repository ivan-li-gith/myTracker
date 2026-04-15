from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.resumes import Resume
from app.schemas.resumes import ResumeRead

router = APIRouter(prefix="/resumes", tags=["resumes"])


@router.get("", response_model=list[ResumeRead])
async def list_resumes(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Resume).order_by(Resume.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ResumeRead, status_code=201)
async def upload_resume(
    name: str = Form(...),
    file_type: str = Form(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
):
    if file_type not in ("resume", "cover_letter"):
        raise HTTPException(status_code=400, detail="file_type must be 'resume' or 'cover_letter'")
    file_data = await file.read()
    record = Resume(
        name=name,
        file_type=file_type,
        filename=file.filename or name,
        content_type=file.content_type or "application/octet-stream",
        file_data=file_data,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return record


@router.get("/{resume_id}/download")
async def download_resume(resume_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Resume).where(Resume.id == resume_id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    return Response(
        content=record.file_data,
        media_type=record.content_type,
        headers={"Content-Disposition": f'attachment; filename="{record.filename}"'},
    )


@router.delete("/{resume_id}", status_code=204)
async def delete_resume(resume_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Resume).where(Resume.id == resume_id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    await session.delete(record)
    await session.commit()
