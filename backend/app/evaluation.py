"""
evaluation.py — RAG Evaluation for AskThePaper
================================================
Contains the evaluation framework config AND the actual evaluation functions.

Supported frameworks:
  • custom    — Built-in metrics (no extra deps): cosine similarity, keyword recall
  • ragas     — RAGAS evaluate (pip install ragas)
  • deepeval  — DeepEval framework (pip install deepeval)
  • trulens   — TruLens (pip install trulens-eval)
  • langsmith — LangSmith (pip install langsmith)

Quick usage
-----------
    from app.evaluation import evaluate_rag_response

    result = await evaluate_rag_response(
        question="What is the main finding?",
        answer="The main finding is X.",
        chunks=[{"content": "X was found in the study.", "score": 0.91, ...}],
        framework="custom",   # or "ragas", "deepeval", etc.
    )
    # result = {"framework": "custom", "context_relevance": 0.87, "answer_faithfulness": 0.75, ...}
"""

from __future__ import annotations
import logging
import math
from typing import Any

logger = logging.getLogger(__name__)

# ─── Available evaluation frameworks ─────────────────────────────────────────
EVALUATION_OPTIONS: list[str] = [
    "custom",
    "ragas",
    "deepeval",
    "trulens",
    "langsmith",
]

DEFAULT_EVALUATION: str = "custom"

# Used directly in admin/router.py DEFAULT_CONFIG
DEFAULT_EVALUATION_CONFIG: dict = {
    "active": DEFAULT_EVALUATION,
    "options": EVALUATION_OPTIONS,
}


# ═══════════════════════════════════════════════════════════════════════════════
# CUSTOM (built-in) EVALUATION — no external dependencies
# ═══════════════════════════════════════════════════════════════════════════════

def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Cosine similarity between two vectors."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _keyword_recall(question: str, context: str) -> float:
    """
    Simple keyword recall: fraction of question content-words found in the context.
    Stopwords are excluded to focus on meaningful terms.
    """
    STOPWORDS = {
        "what", "is", "the", "are", "a", "an", "of", "in", "on", "to",
        "how", "why", "when", "who", "where", "does", "do", "was", "were",
        "has", "have", "had", "be", "been", "being", "and", "or", "but",
        "it", "its", "this", "that", "these", "those",
    }
    question_words = {
        w.lower().strip("?.,!\"'():")
        for w in question.split()
        if w.lower() not in STOPWORDS and len(w) > 2
    }
    if not question_words:
        return 1.0
    context_lower = context.lower()
    found = sum(1 for w in question_words if w in context_lower)
    return found / len(question_words)


def _answer_faithfulness(answer: str, context: str) -> float:
    """
    Heuristic faithfulness: how many answer sentences have at least one
    matching content-word in the retrieved context.
    """
    import re
    sentences = re.split(r'(?<=[.!?])\s+', answer.strip())
    if not sentences:
        return 0.0
    context_lower = context.lower()
    supported = 0
    for sent in sentences:
        words = {w.lower().strip("?.,!\"'():") for w in sent.split() if len(w) > 3}
        if any(w in context_lower for w in words):
            supported += 1
    return supported / len(sentences)


def evaluate_custom(
    question: str,
    answer: str,
    chunks: list[dict],
) -> dict:
    """
    Built-in evaluation using heuristic metrics — no API keys required.

    Returns
    -------
    dict with keys:
        framework           : "custom"
        context_relevance   : avg cosine similarity score of retrieved chunks (0–1)
        keyword_recall      : fraction of question keywords found in context (0–1)
        answer_faithfulness : fraction of answer sentences supported by context (0–1)
        overall_score       : weighted average of the three metrics (0–1)
        chunks_evaluated    : number of chunks used
    """
    if not chunks:
        return {
            "framework": "custom",
            "context_relevance": 0.0,
            "keyword_recall": 0.0,
            "answer_faithfulness": 0.0,
            "overall_score": 0.0,
            "chunks_evaluated": 0,
            "note": "No chunks were retrieved.",
        }

    # 1. Context relevance — use the pre-computed cosine scores
    scores = [c.get("score", 0.0) for c in chunks]
    context_relevance = sum(scores) / len(scores)

    # 2. Keyword recall — question keywords vs. full combined context
    combined_context = "\n".join(c.get("content", "") for c in chunks)
    keyword_recall = _keyword_recall(question, combined_context)

    # 3. Answer faithfulness
    answer_faithfulness = _answer_faithfulness(answer, combined_context)

    # 4. Overall (weighted: relevance 40%, recall 30%, faithfulness 30%)
    overall_score = (
        0.40 * context_relevance +
        0.30 * keyword_recall +
        0.30 * answer_faithfulness
    )

    return {
        "framework": "custom",
        "context_relevance": round(context_relevance, 4),
        "keyword_recall": round(keyword_recall, 4),
        "answer_faithfulness": round(answer_faithfulness, 4),
        "overall_score": round(overall_score, 4),
        "chunks_evaluated": len(chunks),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# RAGAS EVALUATION (optional — pip install ragas)
# ═══════════════════════════════════════════════════════════════════════════════

async def evaluate_ragas(
    question: str,
    answer: str,
    chunks: list[dict],
) -> dict:
    """
    Evaluate using the RAGAS framework.
    Metrics: faithfulness, answer_relevancy, context_precision, context_recall.

    Requires: pip install ragas
    """
    try:
        from ragas import evaluate
        from ragas.metrics import faithfulness, answer_relevancy, context_precision
        from datasets import Dataset
    except ImportError:
        logger.warning("RAGAS not installed. Falling back to custom evaluation.")
        return {**evaluate_custom(question, answer, chunks), "framework": "ragas_fallback"}

    contexts = [c["content"] for c in chunks]
    dataset = Dataset.from_dict({
        "question": [question],
        "answer":   [answer],
        "contexts": [contexts],
    })

    try:
        result = evaluate(dataset, metrics=[faithfulness, answer_relevancy, context_precision])
        row = result.to_pandas().iloc[0]
        return {
            "framework": "ragas",
            "faithfulness":       round(float(row.get("faithfulness", 0)), 4),
            "answer_relevancy":   round(float(row.get("answer_relevancy", 0)), 4),
            "context_precision":  round(float(row.get("context_precision", 0)), 4),
            "overall_score":      round(float(row[["faithfulness", "answer_relevancy", "context_precision"]].mean()), 4),
            "chunks_evaluated":   len(chunks),
        }
    except Exception as e:
        logger.error(f"RAGAS evaluation failed: {e}")
        return {**evaluate_custom(question, answer, chunks), "framework": "ragas_error", "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC DISPATCHER
# ═══════════════════════════════════════════════════════════════════════════════

async def evaluate_rag_response(
    question: str,
    answer: str,
    chunks: list[dict],
    framework: str = DEFAULT_EVALUATION,
) -> dict[str, Any]:
    """
    Main evaluation entry point. Routes to the correct framework.

    Parameters
    ----------
    question  : The user's original question.
    answer    : The LLM-generated answer.
    chunks    : Retrieved chunks list (each must have 'content' and 'score').
    framework : One of EVALUATION_OPTIONS. Defaults to 'custom'.

    Returns
    -------
    dict — evaluation metrics (keys depend on framework).
    """
    logger.info(f"📊 Running RAG evaluation | framework={framework} | chunks={len(chunks)}")

    if framework == "ragas":
        return await evaluate_ragas(question, answer, chunks)

    elif framework == "custom":
        result = evaluate_custom(question, answer, chunks)
        logger.info(
            f"📊 Evaluation done | overall={result['overall_score']:.3f} "
            f"relevance={result['context_relevance']:.3f} "
            f"recall={result['keyword_recall']:.3f} "
            f"faithfulness={result['answer_faithfulness']:.3f}"
        )
        return result

    else:
        # deepeval / trulens / langsmith — placeholder (requires extra setup)
        logger.warning(
            f"Framework '{framework}' is configured but not yet implemented. "
            "Falling back to custom evaluation."
        )
        result = evaluate_custom(question, answer, chunks)
        result["framework"] = f"{framework}_not_implemented_fallback"
        return result
