# ZOMA AI

ZOMA AI is a general-purpose AI chat web app. The frontend is static and can be hosted on GitHub Pages. The FastAPI backend runs separately (for example on Render) and keeps the Gemini API key server-side.

## Repository layout

The frontend files are intentionally at the repository root so GitHub Pages can serve `index.html` directly.

- `index.html`
- `style.css`
- `app.js`
- `database.js`
- `backup.js`
- `transfer.js`
- `config.js`
- `backend/`

## Security

NEVER put the Gemini API key in frontend files or GitHub.

For local development, create `backend/.env` from `backend/.env.example` and set:

`GEMINI_API_KEY=YOUR_KEY`

`backend/.env` is ignored by Git.

For Render, add the secret as an Environment Variable named `GEMINI_API_KEY`.

## GitHub Pages

The repository root contains `index.html`, so GitHub Pages can publish from the `main` branch root (`/(root)`).

## Render backend

Create a Web Service from the same GitHub repository and set **Root Directory** to `backend`.

Build command:

`pip install -r requirements.txt`

Start command:

`uvicorn main:app --host 0.0.0.0 --port $PORT`

Environment variable:

`GEMINI_API_KEY` = your Gemini API key

After Render gives you the backend URL, update only `config.js`:

`API_BASE_URL: "https://YOUR-RENDER-SERVICE.onrender.com"`

No Gemini key is placed in `config.js`.

## Local run

Backend:

`cd backend`

`py -m venv .venv`

Windows PowerShell:

`.\\.venv\\Scripts\\Activate.ps1`

`pip install -r requirements.txt`

Create `backend/.env` and put your Gemini key there.

`py -m uvicorn main:app --reload --host 127.0.0.1 --port 8000`

Frontend (from the repository root):

`py -m http.server 5500`

Open `http://127.0.0.1:5500`.

## Local data

Conversations and local attachments are stored in the browser using IndexedDB. Backup/restore is provided by the frontend. Browser storage is local to the device and should not be treated as an absolute permanent backup; keep `.zoma` backups for important data.
