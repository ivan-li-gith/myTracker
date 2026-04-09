import json
import re

import httpx
from bs4 import BeautifulSoup
import google.generativeai as genai

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


def fetch_and_clean(url: str) -> str:
    """Fetch a URL and return cleaned visible text, truncated to ~8000 chars."""
    with httpx.Client(follow_redirects=True, timeout=20.0) as client:
        response = client.get(url, headers=_HEADERS)
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(_STRIP_TAGS):
        tag.decompose()

    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:8000]


def _strip_fences(text: str) -> str:
    text = re.sub(r"^```[a-z]*\n?", "", text.strip())
    text = re.sub(r"\n?```$", "", text)
    return text.strip()


def extract_recipe_info(raw_text: str) -> dict:
    """Send cleaned recipe text to Gemini Flash and return extracted fields."""
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")

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

    response = model.generate_content(prompt)
    try:
        return json.loads(_strip_fences(response.text))
    except (json.JSONDecodeError, ValueError):
        return {
            "title": None,
            "ingredients": None,
            "steps": None,
            "cook_time": None,
            "category": None,
        }


def extract_job_info(raw_text: str) -> dict:
    """Send cleaned job text to Gemini Flash and return extracted fields."""
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")

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

    response = model.generate_content(prompt)
    try:
        return json.loads(_strip_fences(response.text))
    except (json.JSONDecodeError, ValueError):
        return {
            "company": None,
            "role": None,
            "location": None,
            "job_type": None,
            "salary_range": None,
        }
