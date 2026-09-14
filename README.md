# ZOMA AI

نسخة جاهزة للرفع على GitHub Pages مع Backend على PythonAnywhere.

## Frontend
- عدّل `config.js` فقط إذا تغيّر عنوان الـBackend.
- لا تضع مفتاح Gemini في أي ملف Frontend.

## Backend
- ضع `GEMINI_API_KEY` داخل `backend/.env` على السيرفر فقط.
- حافظ على Proxy الخاص بـPythonAnywhere للحسابات التي تحتاجه.
- `ALLOWED_ORIGINS` يجب أن يتضمن `https://mohamkhamis209-hub.github.io`.

## البيانات
المحادثات محفوظة محليًا في IndexedDB. النسخ الاحتياطي `.zoma` يدعم التشفير بكلمة مرور.

## ZOMA AI 2-engine architecture

- Normal chat no longer calls Gemini. It uses the external text engine configured by `ZOMA_TEXT_API_URL`, `OPENROUTER_API_KEY`, and `ZOMA_TEXT_MODEL`.
- Web research no longer uses Gemini Search. ZOMA performs web search separately, then uses the external text engine to organize the results.
- PDF/DOCX/XLSX/ZIP creation is local (ReportLab/python-docx/openpyxl/zipfile) and uses the external text engine only to write the content.
- Gemini remains reserved for image generation/editing and the existing image/PDF analysis paths.
- Transfer, restore, and attachments were intentionally left unchanged.

### PythonAnywhere environment
Copy the values from `backend/.env.example` into `backend/.env`. The `OPENROUTER_API_KEY` is a server-side secret and must not be placed in `config.js` or frontend code.
