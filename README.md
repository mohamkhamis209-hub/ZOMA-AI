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
