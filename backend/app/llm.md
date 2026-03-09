# LLM Module (`llm.py`)

Routes every AI question to the correct cloud provider based on which model is active in the admin config.

## Supported Providers

| Provider | Models | Key Needed |
|---|---|---|
| **Google Gemini** | gemini-2.0-flash, 1.5-flash, 1.5-pro | `GOOGLE_API_KEY` or `GEMINI_API_KEY` |
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-3.5-turbo | `OPENAI_API_KEY` |
| **Anthropic** | claude-3-haiku/sonnet/opus, claude-3.5-sonnet | `ANTHROPIC_API_KEY` |
| **Groq** | llama-3.1-70b, llama-3.1-8b, mixtral-8x7b, gemma2-9b | `GROQ_API_KEY` |

## Functions

### `provider_for_model(model_id) → str`
Looks up which provider a given `model_id` belongs to by scanning `LLM_CATALOGUE`.

### `get_llm_response(system_prompt, user_message, model_id, temperature) → str`
**Main entry point.** Resolves the provider and dispatches to the correct private function below.

- `system_prompt` — Instructions for the model (injected RAG context from `prompts.py`).
- `user_message` — The user's raw question.
- `model_id` — Falls back to `DEFAULT_MODEL` (`gemini-1.5-flash`) if not given.
- `temperature` — How creative/random the response is (0.0 = fully factual, 1.0 = creative).

### Private provider functions
| Function | Provider |
|---|---|
| `_call_google(...)` | Google Gemini |
| `_call_openai(...)` | OpenAI Chat API |
| `_call_anthropic(...)` | Anthropic Messages API |
| `_call_groq(...)` | Groq inference API (OpenAI-compatible) |

## Constants

| Constant | Value | Purpose |
|---|---|---|
| `LLM_CATALOGUE` | dict | Full provider → models map shown in the admin panel |
| `ALL_MODEL_IDS` | list | Flat list of every valid model ID (used for validation) |
| `DEFAULT_MODEL` | `gemini-1.5-flash` | Used when no model is configured |
| `DEFAULT_PROVIDER` | `google` | Fallback provider |

## How to Add a New Model
1. Add an entry to `LLM_CATALOGUE` under the correct provider key.
2. If it is a completely new provider, create a new `_call_<provider>(...)` function and add a branch in `get_llm_response`.
3. Set the required API key as an environment variable in `.env`.

## Debugging LLM Failures
All calls are logged at `INFO` level. If a call fails you will see:

```
ERROR app.llm — LLM Error: <error message>
```

Check the terminal / Docker logs with:
```bash
docker compose logs -f backend
```

Common causes:
- Missing or expired API key (check `.env`).
- Model name typo (check `LLM_CATALOGUE`).
- Rate limiting — reduce request frequency or upgrade plan.
