# `main.py` — Explanation

## What This File Does

`main.py` is the **entry point** of the FastAPI backend. It:

1. Creates the FastAPI application instance.
2. Adds **CORS middleware** so our React frontends can talk to this API.
3. Defines two starter endpoints: `/` (welcome) and `/health` (health check).

---

## Packages Used

| Package | Purpose |
|---------|---------|
| **`fastapi`** | Modern, async Python web framework with automatic OpenAPI docs. We chose it over Flask/Django because it's async-native, has built-in request validation via Pydantic, and generates Swagger UI for free. |
| **`fastapi.middleware.cors`** | Built-in middleware to handle Cross-Origin Resource Sharing. Without this, browsers block requests from our React dev server (port 5173) to the API (port 8000). |
| **`uvicorn`** | ASGI server that actually runs the FastAPI app. Think of FastAPI as the "rules" and Uvicorn as the "engine" that serves HTTP requests. The `[standard]` extra includes `uvloop` (faster event loop) and `httptools` (faster HTTP parsing). |

---

## Endpoints

### `GET /`
- **Purpose**: Confirms the API is reachable.
- **Response**: `{ "message": "Welcome to AskThePaper API 🚀", "docs": "/docs" }`

### `GET /health`
- **Purpose**: Health check for monitoring / CI.
- **Response**: `{ "status": "ok" }`

---

## How to Run

```bash
cd backend/
uv run uvicorn app.main:app --reload
```

- `app.main:app` tells Uvicorn: "In the `app/` package, open `main.py`, and find the variable called `app`."
- `--reload` watches for file changes and restarts automatically (dev only).

Visit **http://localhost:8000/docs** for the interactive Swagger UI.

---

## Why FastAPI?

| Feature | Benefit |
|---------|---------|
| **Async / await** | Handle many concurrent requests without threads |
| **Type hints → validation** | Pydantic models auto-validate request bodies |
| **Auto docs** | Swagger UI + ReDoc generated from your code |
| **Dependency injection** | Clean way to share DB connections, auth, etc. |

---

## Why CORS?

Browsers enforce the **Same-Origin Policy** — JavaScript on `localhost:5173` cannot fetch from `localhost:8000` unless the server explicitly allows it. Our CORS middleware sends the right `Access-Control-Allow-*` headers to permit cross-origin requests.

> **Production note**: Replace `allow_origins=["*"]` with your actual frontend URLs to avoid exposing the API to every domain.
