from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.jobs import JobApplication
from app.schemas.jobs import JobApplicationCreate, JobApplicationRead, JobApplicationUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobApplicationRead])
async def list_jobs(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(
        select(JobApplication).order_by(JobApplication.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=JobApplicationRead, status_code=201)
async def create_job(body: JobApplicationCreate, session: AsyncSession = Depends(get_db_session)):
    job = JobApplication(**body.model_dump())
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


@router.patch("/{job_id}", response_model=JobApplicationRead)
async def update_job(
    job_id: int,
    body: JobApplicationUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(JobApplication).where(JobApplication.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(job, key, value)
    await session.commit()
    await session.refresh(job)
    return job


@router.delete("/{job_id}", status_code=204)
async def delete_job(job_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(JobApplication).where(JobApplication.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    await session.delete(job)
    await session.commit()
