# Chat Router (`chat/router.py`)

Handles all end-user chat interactions: question answering via RAG, session management, and public config.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/chat/topics` | List all topics (folders) that have embedded documents |
| `GET` | `/chat/witty` | Return a random witty loading phrase for the frontend |
| `GET` | `/chat/config` | Public config: debug mode, available models & strategies |
| `POST` | `/chat/ask` | **Main RAG query** — returns an answer + optional debug info |
| `GET` | `/chat/sessions` | List all chat sessions (ordered by most recent) |
| `GET` | `/chat/sessions/{id}` | Get full message history for one session |
| `DELETE` | `/chat/sessions/{id}` | Delete a session and all its messages |

## How `/chat/ask` Works (Step by Step)

```
1. Check if chat is enabled (admin kill-switch).
2. Create or resume a session (UUID in MongoDB).
3. Resolve which embedding model, LLM model, and strategy to use
   (from req body → config defaults).
4. Find all embedded papers in the requested topic.
5. Embed the question and run cosine similarity search
   → top-K chunks returned.
6. Build the system prompt via build_rag_system_prompt() (prompts.py).
7. Call get_llm_response() (llm.py) → answer string.
8. If debug_mode is ON → run evaluate_rag_response() (evaluation.py).
9. Persist message + debug payload to MongoDB.
10. Return AskResponse JSON.
```

## Request Body (`AskRequest`)

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | string | ✅ | The user's question |
| `topic_id` | string | ✅ | Folder ID or `"uncategorized"` |
| `session_id` | string | ❌ | Omit to start a new session |
| `strategy` | string | ❌ | Override chunking strategy |
| `model_id` | string | ❌ | Override LLM model |
| `top_k` | int | ❌ | Number of chunks to retrieve (default 5) |

## Response (`AskResponse`)

| Field | When present |
|---|---|
| `answer` | Always |
| `session_id` | Always |
| `message_id` | Always |
| `debug` | Only when admin `debug_mode = true` |

### `debug` block contains:
- `model_id`, `embed_model`, `strategy_filter`, `top_k`
- `chunks` — retrieved source chunks with scores
- `evaluation` — metrics from `evaluation.py` (context relevance, faithfulness, etc.)

## Debugging Chat Issues

All steps are logged. Run:
```bash
docker compose logs -f backend | grep -E "(chat|LLM|eval|chunk|embed)"
```

Common failures:
- **LLM timeout/error** → Check API key in `.env`, check `llm.md`.
- **No chunks found** → Paper may not be embedded yet — check admin dashboard.
- **Wrong strategy** → Verify the strategy has been run for this paper.
