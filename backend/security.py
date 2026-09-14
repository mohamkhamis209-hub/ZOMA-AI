import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException


ENV_FILE = Path(__file__).with_name(".env")
load_dotenv(ENV_FILE)


MAX_TEXT_CHARS = 12000
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def require_api_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "").strip()

    if not key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured on the server."
        )

    return key
