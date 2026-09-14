# ZOMA AI – Final Tools Update

This build keeps the existing conversation transfer/restore system and adds:

- Create PDF, Word, Excel and ZIP files from a prompt.
- Save generated files inside the current conversation and export/restore them with the conversation.
- Generate images from text.
- Edit an uploaded image from a text instruction.
- Download generated images/files from the conversation.
- Existing image/file analysis remains available.

## Backend update

Upload the files inside `backend/` to:

`/home/mohamkhamis209/ZOMA-AI/backend/`

Then in the PythonAnywhere virtualenv run:

`pip install -r /home/mohamkhamis209/ZOMA-AI/backend/requirements.txt`

Then go to Web and click Reload.

The image model defaults to `gemini-3.1-flash-image`. You can override it in `.env` with:

`ZOMA_IMAGE_MODEL=gemini-3.1-flash-image`

The Gemini API key remains in `.env` as `GEMINI_API_KEY=...`.

## New API endpoints

- `POST /api/create-file`
- `POST /api/generate-image`

Existing endpoints are unchanged:

- `POST /api/chat`
- `POST /api/analyze-file`
- `POST /api/transfer/create`
- `POST /api/transfer/receive`
