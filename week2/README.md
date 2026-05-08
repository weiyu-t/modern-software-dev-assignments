# Week 2 Action Item Extractor

A minimal FastAPI and SQLite application that turns free-form notes into saved action items. The app includes a simple HTML frontend, a heuristic extractor, an optional Ollama-powered extractor, persistent note/action-item storage, and unit tests for the extraction logic.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Setup](#setup)
- [Configuration](#configuration)
- [Running the App](#running-the-app)
- [Frontend Functionality](#frontend-functionality)
- [API Endpoints](#api-endpoints)
- [Running Tests](#running-tests)
- [Development Notes](#development-notes)

## Features

- Extract action items from pasted notes with deterministic heuristics.
- Extract action items with a local Ollama model using structured JSON output.
- Save raw notes and associate extracted action items with saved notes.
- List saved action items and update their completion status.
- List, create, and fetch saved raw notes through API endpoints.
- Serve a lightweight HTML frontend from the FastAPI app.

## Project Structure

```text
week2/
├── app/
│   ├── config.py              # Environment-driven app settings
│   ├── db.py                  # SQLite connection, schema, and persistence helpers
│   ├── main.py                # FastAPI app, lifespan startup, frontend route
│   ├── routers/
│   │   ├── action_items.py    # Action item extraction/list/update endpoints
│   │   └── notes.py           # Note create/list/read endpoints
│   ├── schemas.py             # Pydantic request and response models
│   └── services/
│       └── extract.py         # Heuristic and LLM extraction functions
├── frontend/
│   └── index.html             # Minimal browser UI
├── tests/
│   └── test_extract.py        # Unit tests for extraction behavior
├── assignment.md              # Assignment instructions
├── writeup.md                 # Assignment write-up template/progress notes
└── README.md
```

The Poetry project metadata is stored one directory above this folder in `../pyproject.toml`, because `week2` is part of the larger assignment repository.

## Requirements

- Python 3.10 or newer
- Poetry
- SQLite, included with Python
- Ollama, only required for the LLM extraction endpoint

Primary Python dependencies are defined in `../pyproject.toml` and include:

- `fastapi`
- `uvicorn`
- `pydantic`
- `python-dotenv`
- `ollama`
- `pytest`

## Setup

From the assignment repository root:

```bash
cd /path/to/modern-software-dev-assignments
poetry install
```

If you use the course conda environment, activate it first:

```bash
conda activate cs146s
poetry install
```

## Configuration

The app reads configuration from environment variables and `.env` files through `python-dotenv`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEEK2_DATA_DIR` | `week2/data` | Directory where the SQLite database is stored. |
| `SQLITE_DB_FILENAME` | `app.db` | SQLite database filename inside `WEEK2_DATA_DIR`. |
| `OLLAMA_MODEL` | `llama3.1:8b` | Local Ollama model used by LLM extraction. |

For LLM extraction, install Ollama and pull the configured model:

```bash
ollama pull llama3.1:8b
```

You can choose a different model:

```bash
export OLLAMA_MODEL=llama3.2:3b
ollama pull "$OLLAMA_MODEL"
```

## Running the App

From the assignment repository root:

```bash
poetry run uvicorn week2.app.main:app --reload
```

Open the frontend at:

```text
http://127.0.0.1:8000/
```

The database schema is created automatically during FastAPI startup.

## Frontend Functionality

The browser UI in `frontend/index.html` supports:

- Pasting raw notes into a textarea.
- Extracting action items with the heuristic endpoint.
- Extracting action items with the Ollama-backed endpoint.
- Saving the pasted text as a note while extracting.
- Listing saved action items.
- Marking saved action items as done or not done.

## API Endpoints

### `GET /`

Returns the HTML frontend.

### `POST /action-items/extract`

Extracts action items with the heuristic extractor and saves the extracted items.

Request body:

```json
{
  "text": "- [ ] Set up database\n- Write tests",
  "save_note": true
}
```

Response body:

```json
{
  "note_id": 1,
  "items": [
    {
      "id": 1,
      "text": "Set up database"
    },
    {
      "id": 2,
      "text": "Write tests"
    }
  ]
}
```

### `POST /action-items/extract-llm`

Extracts action items with the configured local Ollama model and saves the extracted items. The endpoint returns `502 Bad Gateway` if the local LLM request fails.

Request and response shapes match `POST /action-items/extract`.

### `GET /action-items`

Lists saved action items, newest first.

Optional query parameter:

- `note_id`: return only action items associated with a specific note.

Example:

```text
GET /action-items?note_id=1
```

Response body:

```json
[
  {
    "id": 2,
    "note_id": 1,
    "text": "Write tests",
    "done": false,
    "created_at": "2026-05-07 12:00:00"
  }
]
```

### `POST /action-items/{action_item_id}/done`

Updates an action item's completion status.

Request body:

```json
{
  "done": true
}
```

Response body:

```json
{
  "id": 2,
  "done": true
}
```

Returns `404 Not Found` if the action item id does not exist.

### `GET /notes`

Lists saved raw notes, newest first.

### `POST /notes`

Creates a raw note without running extraction.

Request body:

```json
{
  "content": "Meeting notes go here"
}
```

### `GET /notes/{note_id}`

Fetches one saved raw note by id. Returns `404 Not Found` if the note does not exist.

## Running Tests

From the `week2` directory:

```bash
pytest -q
```

Or from the assignment repository root:

```bash
poetry run pytest week2/tests -q
```

The current unit tests cover:

- Heuristic extraction from bullets, checkboxes, and numbered lists.
- LLM extraction for empty input.
- LLM extraction response parsing.
- Keyword-prefixed lines.
- Deduplication.
- Empty or whitespace-only model items.
- System prompt cleanup instructions.

## Development Notes

- The heuristic extractor is implemented in `app/services/extract.py`.
- The LLM extractor uses Ollama structured output and expects a JSON object with an `items` array.
- SQLite tables are created by `app/db.py` during application startup.
- Pydantic schemas in `app/schemas.py` define the API contracts.
- The frontend is intentionally lightweight and does not require a build step.
