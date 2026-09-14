import os
from fastapi import HTTPException

MAX_TEXT_CHARS = 30000
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def require_api_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key or key == "PUT_YOUR_GEMINI_API_KEY_HERE":
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the server.")
    return key
