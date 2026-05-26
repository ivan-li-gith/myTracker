import base64
import io
import json
import re
from datetime import date

import fitz  # PyMuPDF
from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image
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
    "You are extracting transactions from a financial document — this may be a receipt, invoice, or bank/credit-card statement.\n\n"
    "Rules:\n"
    "- For a RECEIPT or INVOICE: extract each line-item charge separately.\n"
    "- For a BANK or CREDIT CARD STATEMENT: extract every debit/purchase row. Skip credits, payments, refunds, interest charges, and running-balance entries.\n"
    "- Return ONLY a raw JSON array with no explanation, no markdown, no code fences.\n"
    "- Each element must have exactly three keys:\n"
    '  "name": string — merchant name or transaction description (clean it up, remove excess codes)\n'
    '  "amount": number — positive dollar amount (do NOT include negative numbers)\n'
    f'  "date": string — YYYY-MM-DD format; use {date.today().isoformat()} if no date is visible\n'
    "- If you see no transactions, return an empty array [].\n"
    "Output ONLY the JSON array, starting with [ and ending with ]."
)

_PDF_PROMPT = (
    "Extract every transaction or charge from the following bill or financial document text. "
    "Return ONLY a JSON array — no explanation, no markdown. Each element must have: "
    '"name" (string, service or item description), '
    '"amount" (number, positive dollars), '
    f'"date" (string, YYYY-MM-DD format; use {date.today().isoformat()} if not shown).'
)

_SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

# Anthropic's hard limit is ~5 MB per image after base64 encoding (~3.75 MB raw).
# We target 3 MB raw to stay safely under that, and cap the long edge at 1568px
# which is Anthropic's recommended max for vision quality.
_MAX_IMAGE_BYTES = 3 * 1024 * 1024  # 3 MB
_MAX_LONG_EDGE = 1568


def _prepare_image(content: bytes, content_type: str) -> tuple[bytes, str]:
    """Resize and re-compress an image so it fits within Anthropic's limits."""
    img = Image.open(io.BytesIO(content))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    # Downscale if the long edge exceeds the limit
    w, h = img.size
    long_edge = max(w, h)
    if long_edge > _MAX_LONG_EDGE:
        scale = _MAX_LONG_EDGE / long_edge
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # Re-encode as JPEG (much smaller than PNG for screenshots)
    buf = io.BytesIO()
    quality = 85
    while True:
        buf.seek(0)
        buf.truncate()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        if buf.tell() <= _MAX_IMAGE_BYTES or quality <= 40:
            break
        quality -= 10

    return buf.getvalue(), "image/jpeg"


def _parse_transactions(raw: str) -> list[ScannedTransaction]:
    match = re.search(r"\[.*\]", raw, re.DOTALL)
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
            max_tokens=4096,
            messages=[{"role": "user", "content": f"{_PDF_PROMPT}\n\n{text}"}],
        )
    elif file.content_type in _SUPPORTED_IMAGE_TYPES:
        content, media_type = _prepare_image(content, file.content_type)
        b64 = base64.standard_b64encode(content).decode()
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
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
