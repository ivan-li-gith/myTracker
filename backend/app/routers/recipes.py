from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.recipes import Recipe
from app.schemas.recipes import RecipeCreate, RecipeRead, RecipeUpdate
from app.services.scraper import fetch_and_clean, extract_recipe_info

router = APIRouter(prefix="/recipes", tags=["recipes"])


class ScrapeRequest(BaseModel):
    url: str


@router.post("/scrape")
def scrape_recipe(body: ScrapeRequest):
    """Scrape a recipe URL and return extracted fields. Does NOT save."""
    try:
        raw_text = fetch_and_clean(body.url)
        info = extract_recipe_info(raw_text)
        return {**info, "source_url": body.url}
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Scraping failed: {str(e)}")


@router.get("", response_model=list[RecipeRead])
async def list_recipes(session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Recipe).order_by(Recipe.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=RecipeRead, status_code=201)
async def create_recipe(body: RecipeCreate, session: AsyncSession = Depends(get_db_session)):
    recipe = Recipe(**body.model_dump())
    session.add(recipe)
    await session.commit()
    await session.refresh(recipe)
    return recipe


@router.patch("/{recipe_id}", response_model=RecipeRead)
async def update_recipe(
    recipe_id: int,
    body: RecipeUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    result = await session.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(recipe, key, value)
    await session.commit()
    await session.refresh(recipe)
    return recipe


@router.patch("/{recipe_id}/favorite", response_model=RecipeRead)
async def toggle_favorite(recipe_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    recipe.is_favorite = not recipe.is_favorite
    await session.commit()
    await session.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(recipe_id: int, session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    await session.delete(recipe)
    await session.commit()
