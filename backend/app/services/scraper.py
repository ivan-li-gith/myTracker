import json
import re

import httpx
from bs4 import BeautifulSoup
from openai import OpenAI

from app.config import settings

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

_STRIP_TAGS = ["script", "style", "nav", "header", "footer", "aside", "noscript", "iframe", "form"]


# ── JSON-LD helpers ────────────────────────────────────────────────────────────

def _parse_duration(duration: str | None) -> str | None:
    """Convert ISO 8601 duration (PT1H30M) to human-readable string."""
    if not duration:
        return None
    m = re.match(r"P(?:.*?T)?(?:(\d+)H)?(?:(\d+)M)?", duration)
    if not m:
        return duration
    hours = int(m.group(1) or 0)
    minutes = int(m.group(2) or 0)
    if hours and minutes:
        return f"{hours} hr {minutes} min"
    if hours:
        return f"{hours} hr"
    if minutes:
        return f"{minutes} min"
    return duration


def _find_jsonld_recipe(soup: BeautifulSoup) -> dict | None:
    """Return the first schema.org/Recipe object found in any JSON-LD block."""
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        # Normalise to a flat list of objects
        if isinstance(data, dict) and "@graph" in data:
            candidates = data["@graph"]
        elif isinstance(data, list):
            candidates = data
        else:
            candidates = [data]

        for item in candidates:
            if not isinstance(item, dict):
                continue
            t = item.get("@type", "")
            if t == "Recipe" or (isinstance(t, list) and "Recipe" in t):
                return item

    return None


def _jsonld_to_recipe(data: dict) -> dict:
    """Map a schema.org Recipe JSON-LD object to our internal format."""
    # Ingredients → markdown bullet list
    raw_ingredients = data.get("recipeIngredient") or []
    ingredients = (
        "\n".join(f"- {i.strip()}" for i in raw_ingredients if i.strip())
        if raw_ingredients else None
    )

    # Instructions → markdown numbered list
    raw_steps = data.get("recipeInstructions") or []
    step_texts: list[str] = []
    for item in raw_steps:
        if isinstance(item, str):
            step_texts.append(item.strip())
        elif isinstance(item, dict):
            # HowToSection contains itemListElement
            if item.get("@type") == "HowToSection":
                for sub in item.get("itemListElement") or []:
                    if isinstance(sub, dict):
                        text = (sub.get("text") or sub.get("name") or "").strip()
                        if text:
                            step_texts.append(text)
            else:
                text = (item.get("text") or item.get("name") or "").strip()
                if text:
                    step_texts.append(text)

    steps = (
        "\n".join(f"{i + 1}. {t}" for i, t in enumerate(step_texts))
        if step_texts else None
    )

    # Category
    cat = data.get("recipeCategory")
    if isinstance(cat, list):
        cat = cat[0] if cat else None

    # Cook time: prefer totalTime, fall back to cookTime
    cook_time = _parse_duration(
        data.get("totalTime") or data.get("cookTime") or data.get("prepTime")
    )

    return {
        "title": data.get("name"),
        "ingredients": ingredients,
        "steps": steps,
        "cook_time": cook_time,
        "category": cat,
    }


# ── HTTP fetch ─────────────────────────────────────────────────────────────────

def _fetch_soup(url: str) -> BeautifulSoup:
    with httpx.Client(follow_redirects=True, timeout=20.0) as client:
        response = client.get(url, headers=_HEADERS)
        response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def _soup_to_text(soup: BeautifulSoup) -> str:
    """Strip boilerplate tags and return visible text (max ~8000 chars)."""
    for tag in soup(_STRIP_TAGS):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()[:8000]


# ── OpenAI fallback ────────────────────────────────────────────────────────────

def _chat(prompt: str) -> str:
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return response.choices[0].message.content or ""


def _strip_fences(text: str) -> str:
    text = re.sub(r"^```[a-z]*\n?", "", text.strip())
    text = re.sub(r"\n?```$", "", text)
    return text.strip()


# ── Public API ─────────────────────────────────────────────────────────────────

def fetch_and_clean(url: str) -> str:
    """Kept for backward compatibility with the jobs router."""
    return _soup_to_text(_fetch_soup(url))


def scrape_recipe(url: str) -> dict:
    """
    Scrape a recipe URL.

    Strategy:
    1. Look for schema.org/Recipe JSON-LD (present on virtually all major recipe
       sites — AllRecipes, Food Network, Serious Eats, NYT Cooking, etc.).
       This is perfectly structured data with no AI needed.
    2. If JSON-LD is missing or incomplete, fall back to GPT-4o-mini with the
       page's visible text.
    """
    soup = _fetch_soup(url)

    jsonld = _find_jsonld_recipe(soup)
    if jsonld:
        result = _jsonld_to_recipe(jsonld)
        # Use JSON-LD if it has at least ingredients or steps
        if result.get("ingredients") or result.get("steps"):
            return result

    # Fallback: AI extraction from visible text
    raw_text = _soup_to_text(soup)
    prompt = f"""Extract recipe information from the text below.
Return ONLY a valid JSON object with exactly these keys (use null for unknown):
{{
  "title": "recipe name",
  "ingredients": "markdown bullet list of ingredients with amounts",
  "steps": "markdown numbered list of preparation steps",
  "cook_time": "e.g. 30 minutes or 1 hour",
  "category": "e.g. Italian, Dessert, Breakfast, Vegetarian"
}}

Recipe text:
{raw_text}"""

    try:
        return json.loads(_strip_fences(_chat(prompt)))
    except (json.JSONDecodeError, ValueError):
        return {
            "title": None,
            "ingredients": None,
            "steps": None,
            "cook_time": None,
            "category": None,
        }


def extract_recipe_info(raw_text: str) -> dict:
    """Legacy: AI extraction from pre-cleaned text."""
    prompt = f"""Extract recipe information from the text below.
Return ONLY a valid JSON object with exactly these keys (use null for unknown):
{{
  "title": "recipe name",
  "ingredients": "markdown bullet list of ingredients with amounts",
  "steps": "markdown numbered list of preparation steps",
  "cook_time": "e.g. 30 minutes or 1 hour",
  "category": "e.g. Italian, Dessert, Breakfast, Vegetarian"
}}

Recipe text:
{raw_text}"""

    try:
        return json.loads(_strip_fences(_chat(prompt)))
    except (json.JSONDecodeError, ValueError):
        return {
            "title": None,
            "ingredients": None,
            "steps": None,
            "cook_time": None,
            "category": None,
        }


def extract_job_info(raw_text: str) -> dict:
    """Send cleaned job text to GPT-4o-mini and return extracted fields."""
    prompt = f"""Extract job posting details from the text below.
Return ONLY a valid JSON object with exactly these keys (use null for unknown):
{{
  "company": "company name or null",
  "role": "job title or null",
  "location": "city/state or Remote or null",
  "job_type": "remote" | "hybrid" | "onsite" | null,
  "salary_range": "$120k - $160k or null"
}}

Job posting text:
{raw_text}"""

    try:
        return json.loads(_strip_fences(_chat(prompt)))
    except (json.JSONDecodeError, ValueError):
        return {
            "company": None,
            "role": None,
            "location": None,
            "job_type": None,
            "salary_range": None,
        }
