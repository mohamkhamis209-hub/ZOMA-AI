import base64
import io
import mimetypes
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name('.env'))

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from gemini import chat, MODEL
from security import require_api_key, MAX_TEXT_CHARS, MAX_IMAGE_BYTES

app = FastAPI(title="ZOMA AI API", version="1.0.0")

origins = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)

class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=40)

@app.get("/")
def root():
    return {"name": "ZOMA AI API", "status": "ok", "model": MODEL}

@app.get("/api/health")
def health():
    configured = bool(os.getenv("GEMINI_API_KEY", "").strip())
    return {"ok": True, "gemini_configured": configured, "model": MODEL}

@app.post("/api/chat")
def api_chat(payload: ChatRequest):
    try:
        answer = chat([m.model_dump() for m in payload.messages])
        return {"ok": True, "reply": answer, "model": MODEL}
    except HTTPException:
        raise
    except Exception as exc:
        # Do not leak provider credentials or internal tracebacks to the browser.
        raise HTTPException(status_code=502, detail="تعذر الاتصال بخدمة الذكاء الاصطناعي الآن. تأكد من المفتاح ثم حاول مرة أخرى.") from exc

@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...), prompt: str = Form("حلل الصورة واشرحها بالتفصيل وبالعربية.")):
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="الملف يجب أن يكون صورة.")
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="حجم الصورة أكبر من 10MB.")
    try:
        client = genai.Client(api_key=require_api_key())
        response = client.models.generate_content(
            model=MODEL,
            contents=[
                types.Part.from_bytes(data=data, mime_type=content_type),
                prompt[:MAX_TEXT_CHARS],
            ],
            config=types.GenerateContentConfig(system_instruction="أنت ZOMA AI. حلل الصور بشكل مفيد وآمن، وأجب بلغة المستخدم. إذا كانت الصورة لسؤال دراسي فاشرح الحل خطوة بخطوة."),
        )
        return {"ok": True, "reply": (response.text or "").strip()}
    except Exception as exc:
        raise HTTPException(status_code=502, detail="تعذر تحليل الصورة الآن.") from exc

@app.exception_handler(Exception)
async def unhandled(_, exc):
    return JSONResponse(status_code=500, content={"ok": False, "detail": "حدث خطأ غير متوقع في الخادم."})
