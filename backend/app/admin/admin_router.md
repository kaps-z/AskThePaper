# Admin Router (`admin/router.py`)

Secured admin API for managing papers, pipeline processing, folders (topics), and system configuration.

> **All endpoints require Basic Auth.** Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`.

## Endpoints

### Authentication
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin/login` | Verify credentials and return welcome message |

### File Management
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin/upload` | Upload a PDF → auto-triggers chunking pipeline |
| `GET` | `/admin/files` | List all uploaded papers with status |
| `DELETE` | `/admin/files/{id}` | Delete paper, all its chunks, and the physical file |
| `GET` | `/admin/files/{id}/chunks` | View chunks for a paper (filter by `?strategy=...`) |
| `DELETE` | `/admin/files/{id}/chunks` | Delete chunks (all or by strategy) |
| `POST` | `/admin/files/{id}/process` | Manually re-run the chunking + embedding pipeline |

### Topics (Folders)
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/topics` | List all topics with document/chunk counts |
| `GET` | `/admin/topics/{id}/files` | Files in a specific topic |
| `DELETE` | `/admin/topics/{id}` | Delete an entire topic with all its documents/chunks |

### Configuration
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/config` | Get current system config (auto-seeds if missing) |
| `PUT` | `/admin/config` | Update config fields |
| `GET` | `/admin/config/llm-catalogue` | List all available LLM providers and models |

## Config Fields (PUT `/admin/config`)

| Field | Type | Description |
|---|---|---|
| `active_strategies` | list[str] | Chunking strategies to run on new uploads |
| `embedding` | str | Active embedding model ID |
| `active_model` | str | Active LLM model ID |
| `evaluation` | str | Active evaluation framework |
| `debug_mode` | bool | Show RAG evaluation debug info in chat |
| `chat_enabled` | bool | Master kill-switch for the chat frontend |
| `frontend_settings.visible_strategies` | list[str] | Strategies shown to users |
| `frontend_settings.visible_models` | list[str] | Models shown to users (empty = all) |

## Upload → Processing Pipeline

```
POST /admin/upload
    ↓
PDF saved to disk /uploads/
    ↓
run_strategies() triggered as BackgroundTask (chunking.py)
    ↓  [for each strategy]
    extract_text_with_metadata() → pages
    get_chunks_for_strategy()    → chunks
    store_chunks()               → MongoDB paper_chunks
    embed_paper_chunks_for_strategy() → embeddings stored (embedding.py)
    ↓
Status: uploaded → processing → embedded (or error)
```

## Default Config (auto-seeded)
Defined as `DEFAULT_CONFIG` in `admin/router.py`. First time the app runs, if no config exists in MongoDB, this is inserted automatically.

## Debugging

```bash
docker compose logs -f backend | grep -E "(admin|pipeline|strategy|embed|error)"
```
