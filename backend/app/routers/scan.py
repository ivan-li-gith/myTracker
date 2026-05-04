import base64
import json
import re
from datetime import date

import fitz  # PyMuPDF
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

import anthropic
from app.config import settings

router = APIRouter(prefix="/scan", tags=["scan"])

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        if not settings.ANTHROPIC_API_KEY:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


class ScannedTransaction(BaseModel):
    name: str
    amount: float
    date: str


class ScanResult(BaseModel):
    transactions: list[ScannedTransaction]


_RECEIPT_PROMPT = (
    "Extract every line-item transaction or charge from this receipt or financial document. "
    "Return ONLY a JSON array — no explanation, no markdown. Each element must have: "
    '"name" (string, merchant or item description), '
    '"amount" (number, positive dollars), '
    f'"date" (string, YYYY-MM-DD format; use {date.today().isoformat()} if the date is not shown). '
    "If multiple items are on one receipt, list each separately. "
    "If only a total is visible, return a single entry using the merchant name and total."
)

_PDF_PROMPT = (
    "Extract every transaction or charge from the following bill or financial document text. "
    "Return ONLY a JSON array — no explanation, no markdown. Each element must have: "
    '"name" (string, service or item description), '
    '"amount" (number, positive dollars), '
    f'"date" (string, YYYY-MM-DD format; use {date.today().isoformat()} if not shown).'
)

_SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


def _parse_transactions(raw: str) -> list[ScannedTransaction]:
    match = re.search(r"\[.*?\]", raw, re.DOTALL)
    if not match:
        return []
    try:
        items = json.loads(match.group())
    except json.JSONDecodeError:
        return []
    result = []
    for item in items:
        try:
            result.append(ScannedTransaction(
                name=str(item.get("name", "Unknown")),
                amount=float(item.get("amount", 0)),
                date=str(item.get("date", date.today().isoformat())),
            ))
        except (ValueError, TypeError):
            continue
    return result


@router.post("/receipt", response_model=ScanResult)
async def scan_receipt(file: UploadFile = File(...)):
    content = await file.read()
    client = _get_client()

    if file.content_type == "application/pdf":
        doc = fitz.open(stream=content, filetype="pdf")
        text = "\n".join(page.get_text() for page in doc)
        if not text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from PDF")
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"{_PDF_PROMPT}\n\n{text}"}],
        )
    elif file.content_type in _SUPPORTED_IMAGE_TYPES:
        b64 = base64.standard_b64encode(content).decode()
        media_type = file.content_type
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": _RECEIPT_PROMPT},
                ],
            }],
        )
    else:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {file.content_type}. Upload a JPEG, PNG, or PDF.")

    raw = response.content[0].text
    transactions = _parse_transactions(raw)
    return ScanResult(transactions=transactions)
