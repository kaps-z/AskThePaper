# `database.py` & `config.py` — Explanation

## 🤔 Sync vs Async: A Beginner's Guide

Before we dive into the code, let's understand the **most important concept** in this file.

### Synchronous (Sync) — "Wait in line"

```python
# SYNC — the program STOPS and waits for the DB to reply
def get_paper_sync():
    result = db.find_one({"title": "..."})  # ← app is frozen here
    return result
```

Imagine a restaurant where the waiter takes your order, walks to the kitchen, **stands there staring at the chef** until the food is ready, then comes back. While that waiter is waiting, **nobody else can be served**.

### Asynchronous (Async) — "Take a number, we'll call you"

```python
# ASYNC — the program continues doing other things while waiting
async def get_paper_async():
    result = await db.find_one({"title": "..."})  # ← releases control while waiting
    return result
```

The waiter takes your order, gives the ticket to the kitchen, and **immediately goes to serve other tables**. When the food is ready, they come back to you. One waiter can serve **hundreds of tables** at the same time.

> **In Python**: `async def` declares an async function.  
> `await` pauses *that function* (releasing the CPU) while the slow task (DB query, HTTP call) runs in the background. The rest of the program keeps going.

### Why does this matter for a RAG API?

A research paper Q&A app might get 100 users asking questions simultaneously. Each question requires:
1. A vector search (MongoDB) → ~20–100ms
2. An LLM call (OpenAI) → ~500–2000ms

With **sync** code: user 100 waits for users 1–99 to finish. Total wait = 100 × 2000ms = **3 minutes**.  
With **async** code: all 100 requests run concurrently. Total wait ≈ **2 seconds**.

---

## Packages Used

| Package | Purpose |
|---------|---------|
| **`motor`** | **Mo**ngoDB **T**wisted **O**peration Ag**r**egation — async MongoDB driver. Built on top of `pymongo` but uses `asyncio` so it never blocks. |
| **`pymongo`** | The official sync MongoDB driver (installed as motor's dependency). |
| **`pydantic-settings`** | Extends Pydantic to load and validate config from `.env` files or environment variables. |
| **`dnspython`** | Needed by pymongo/motor to resolve `mongodb+srv://` DNS connection strings (installed automatically). |

---

## `config.py` — Why Not Just `os.getenv()`?

You *could* do this:
```python
import os
MONGODB_URL = os.getenv("MONGODB_URL")
```

But `pydantic-settings` gives you several advantages:

| Raw `os.getenv()` | `pydantic-settings` |
|-------------------|---------------------|
| Returns `None` silently if missing | Raises a clear error at startup |
| No type coercion | `PORT: int` auto-converts `"8000"` → `8000` |
| No `.env` file support built-in | Reads `.env` automatically |
| No single source of truth | One `settings` object imported everywhere |

---

## `database.py` — Key Concepts

### The Motor Client

```python
_client = AsyncIOMotorClient(settings.MONGODB_URL)
```

- Creates a **connection pool** — a set of ready-to-use DB connections.
- We create it **once** at startup and reuse it. Creating a new client per-request is very expensive.

### `get_database()`

```python
def get_database() -> AsyncIOMotorDatabase:
    return get_client()[settings.DATABASE_NAME]
```

- Returns a handle to our named database inside MongoDB.
- In MongoDB, databases and collections are created **lazily** — they appear the first time you write data.

### FastAPI Lifespan

```python
@asynccontextmanager
async def lifespan(app):
    await client.admin.command("ping")  # startup check
    yield                               # app runs
    client.close()                      # shutdown cleanup
```

The `yield` divides startup from shutdown. This is Python's **context manager** pattern — the same one used by `with open(file)`.

---

## Why `.env` Instead of Hardcoding Secrets?

```python
# ❌ NEVER do this — if you push to GitHub, everyone can steal your DB
MONGODB_URL = "mongodb://root:my_real_password@prod-db.example.com"

# ✅ Do this instead — the secret stays on YOUR machine
MONGODB_URL = settings.MONGODB_URL  # loaded from .env at runtime
```

### The `.gitignore` rule

`uv init` already added `.env` to `.gitignore`. This means Git will **never track** the `.env` file, so your passwords stay off the internet.

When deploying to production, you set environment variables directly on the server (e.g., via Docker secrets, Railway env vars, or AWS Secrets Manager) — no `.env` file needed.
