# Prompts Module (`prompts.py`)

**This is the main file to edit if you want to change how the LLM behaves.**

All system prompts and prompt-building helpers live here, keeping them completely separate from routing and business logic.

## Constants

### `SYSTEM_PERSONA` (string)
The static "personality + rules" block prepended to every RAG call.  
**Edit this to change:**
- The tone of replies (formal vs casual)
- How the LLM cites sources (e.g., "[Source 1]")
- Guardrails (e.g., "never guess", "professional tone")
- Whether it uses bullet points, etc.

### `_CONTEXT_BLOCK_TEMPLATE` (string)
Template that wraps the retrieved chunk text before appending it to the system prompt.  
Usually you do not need to change this, but you can reformat how sources are displayed.

## Functions

### `build_rag_system_prompt(chunks) → str`
Builds the complete system prompt for a single `/chat/ask` call.

**Parameters:**
- `chunks` — list of dicts from `_retrieve_chunks`. Each must have `content`, `strategy`, `metadata.page`, `score`.

**Returns:** Full system prompt string = `SYSTEM_PERSONA` + formatted context block.

**Called by:** `chat/router.py` → `ask()` endpoint.

## How It Works (Data Flow)

```
User question
    ↓
_retrieve_chunks()         ← cosine similarity search in MongoDB
    ↓
build_rag_system_prompt()  ← THIS FILE: formats chunks into the system prompt
    ↓
get_llm_response()         ← llm.py: sends prompt to the active model
    ↓
Answer returned to user
```

## Example: Changing the Persona

Open `prompts.py` and edit `SYSTEM_PERSONA`:

```python
SYSTEM_PERSONA = """You are AskThePaper, a friendly academic helper.
Speak in simple English. Always cite your source like [Source 1].
If you don't know, say "I'm not sure based on the document."
"""
```

Save and the change takes effect immediately (no restart needed in dev mode).
