# Evaluation Module (`evaluation.py`)

Measures how good our RAG pipeline is — how relevant the retrieved chunks are, and how faithful the LLM's answer is to those chunks.

## Why Evaluate?
Without evaluation you are flying blind. These metrics let you compare:
- Different chunking strategies (recursive vs semantic).
- Different embedding models.
- Different LLMs.

## Configuration

The active framework is stored in MongoDB (`system_config.evaluation.active`) and can be changed from the Admin Settings panel.

| Framework | Status | Requires |
|---|---|---|
| `custom` | ✅ Built-in, no setup | Nothing extra |
| `ragas` | ✅ Supported | `pip install ragas` |
| `deepeval` | 🔜 Placeholder | `pip install deepeval` |
| `trulens` | 🔜 Placeholder | `pip install trulens-eval` |
| `langsmith` | 🔜 Placeholder | LangSmith API key |

## Functions

### `evaluate_custom(question, answer, chunks) → dict`
**Built-in evaluation — no API keys needed.**

Computes three metrics:
| Metric | What it measures | How |
|---|---|---|
| `context_relevance` | Are the retrieved chunks relevant to the question? | Average cosine similarity score of chunks (pre-computed during retrieval) |
| `keyword_recall` | Are the question's key words present in the context? | Fraction of content words from the question found in the combined chunks |
| `answer_faithfulness` | Is the answer supported by the retrieved context? | Fraction of answer sentences that contain at least one word also in the context |
| `overall_score` | Weighted average | 40% relevance + 30% recall + 30% faithfulness |

### `evaluate_ragas(question, answer, chunks) → dict` *(async)*
Uses the [RAGAS](https://docs.ragas.io) library for industry-standard metrics.  
Falls back to `evaluate_custom` if RAGAS is not installed.

Metrics returned: `faithfulness`, `answer_relevancy`, `context_precision`.

### `evaluate_rag_response(question, answer, chunks, framework) → dict` *(async)*
**Main entry point.** Dispatches to the correct framework based on the `framework` parameter.  
Called automatically inside `chat/router.py` when `debug_mode` is on.

## How Scores Appear in the Chat
When the admin turns on **Debug Mode** in the Settings panel, each chat response includes a `debug` block with the evaluation scores visible to the user.

## Interpreting Scores
| Score range | Meaning |
|---|---|
| 0.8 – 1.0 | Excellent — the RAG pipeline is working well |
| 0.5 – 0.8 | Acceptable — room for improvement |
| 0.0 – 0.5 | Poor — consider switching chunking strategy or embedding model |

## Constants

| Constant | Value |
|---|---|
| `EVALUATION_OPTIONS` | `["custom", "ragas", "deepeval", "trulens", "langsmith"]` |
| `DEFAULT_EVALUATION` | `"custom"` |
| `DEFAULT_EVALUATION_CONFIG` | Dict used in the seeded MongoDB config |
