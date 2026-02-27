"""
embedding.py — Config-driven vector embedding for text chunks.
==============================================================
Supports multiple open-source HuggingFace embedding models.
The active model is read from the global config in MongoDB at runtime.
All models are downloaded from HuggingFace Hub on first use and cached.

Supported free models
---------------------
  all-MiniLM-L6-v2          384d   fast, small, great default
  BAAI/bge-m3                1024d  hybrid retrieval, 8192 token ctx
  intfloat/e5-large-v2       1024d  strong general-purpose
  Snowflake/snowflake-arctic-embed-l-v2.0  1024d  high quality
  jinaai/jina-embeddings-v3  1024d  multi-task, flexible
"""

import logging
from typing import List, Optional
from sentence_transformers import SentenceTransformer
from app.core.database import get_database
from bson import ObjectId

logger = logging.getLogger(__name__)

# ─── Model catalogue (id → display info) ────────────────────────────────────
EMBEDDING_MODELS = {
    "all-MiniLM-L6-v2": {
        "label": "all-MiniLM-L6-v2",
        "dims": 384,
        "hf_id": "sentence-transformers/all-MiniLM-L6-v2",
        "desc": "Small (384d) and very fast. Best default for quick prototyping.",
        "ctx": "512 tokens",
        "source": "sentence-transformers",
        "free": True,
    },
    "BAAI/bge-m3": {
        "label": "BGE-M3",
        "dims": 1024,
        "hf_id": "BAAI/bge-m3",
        "desc": "Hybrid dense+sparse+colbert retrieval. Excellent for academic papers.",
        "ctx": "8192 tokens",
        "source": "BAAI",
        "free": True,
    },
    "intfloat/e5-large-v2": {
        "label": "E5-large-v2",
        "dims": 1024,
        "hf_id": "intfloat/e5-large-v2",
        "desc": "Popular Microsoft model. Efficient and reliable for general semantic search.",
        "ctx": "512 tokens",
        "source": "Microsoft / intfloat",
        "free": True,
    },
    "Snowflake/snowflake-arctic-embed-l-v2.0": {
        "label": "Arctic-Embed-L v2",
        "dims": 1024,
        "hf_id": "Snowflake/snowflake-arctic-embed-l-v2.0",
        "desc": "High-quality retrieval embeddings from Snowflake AI Research.",
        "ctx": "512 tokens",
        "source": "Snowflake",
        "free": True,
    },
    "jinaai/jina-embeddings-v3": {
        "label": "Jina Embeddings v3",
        "dims": 1024,
        "hf_id": "jinaai/jina-embeddings-v3",
        "desc": "Multi-task embeddings with task-type routing. Flexible and powerful.",
        "ctx": "8192 tokens",
        "source": "Jina AI",
        "free": True,
    },
}

DEFAULT_MODEL_ID = "all-MiniLM-L6-v2"

# ─── In-process model cache (avoid reloading on every request) ───────────────
_model_cache: dict = {}


def get_model(model_id: Optional[str] = None) -> SentenceTransformer:
    """
    Lazy-load and cache a SentenceTransformer model by its catalogue ID.
    Falls back to DEFAULT_MODEL_ID if the id is not in the catalogue.
    """
    global _model_cache
    model_id = model_id or DEFAULT_MODEL_ID
    info = EMBEDDING_MODELS.get(model_id)
    if not info:
        logger.warning(f"Unknown embedding model '{model_id}', falling back to {DEFAULT_MODEL_ID}")
        model_id = DEFAULT_MODEL_ID
        info = EMBEDDING_MODELS[model_id]

    if model_id not in _model_cache:
        hf_id = info["hf_id"]
        logger.info(f"💾 Loading embedding model: {hf_id} ...")

        # jina-embeddings-v3 requires trust_remote_code=True
        kwargs = {}
        if "jina" in hf_id.lower():
            kwargs["trust_remote_code"] = True

        _model_cache[model_id] = SentenceTransformer(hf_id, **kwargs)
        logger.info(f"✅ {info['label']} loaded (dims={info['dims']}).")

    return _model_cache[model_id]


async def _get_active_model_id() -> str:
    """Read the active embedding model from the DB config."""
    try:
        db = get_database()
        cfg = await db["system_config"].find_one({"_id": "global_config"})
        return (cfg or {}).get("embedding", {}).get("active", DEFAULT_MODEL_ID)
    except Exception:
        return DEFAULT_MODEL_ID


# ─── Public embed API ────────────────────────────────────────────────────────
def embed_text(text: str, model_id: Optional[str] = None) -> List[float]:
    """Generate a vector for a single string (sync, for retrieval queries)."""
    return get_model(model_id).encode(text).tolist()


def embed_batch(texts: List[str], model_id: Optional[str] = None) -> List[List[float]]:
    """Generate vectors for a batch of strings (sync, for chunking pipeline)."""
    return get_model(model_id).encode(texts, batch_size=64, show_progress_bar=False).tolist()


# ─── Pipeline helpers ────────────────────────────────────────────────────────
async def embed_paper_chunks(paper_id: str):
    """Fetch all chunks for a paper (all strategies) and embed them."""
    db = get_database()
    paper_oid = ObjectId(paper_id)
    model_id = await _get_active_model_id()
    cursor = db["paper_chunks"].find({"paper_id": paper_oid})
    chunks = await cursor.to_list(length=None)
    await _embed_and_update(chunks, model_id)
    await db["admin_files"].update_one({"_id": paper_oid}, {"$set": {"status": "embedded"}})
    logger.info(f"✅ Embedding complete for paper {paper_id} (model={model_id}).")


async def embed_paper_chunks_for_strategy(paper_id: str, strategy: str):
    """Embed chunks for one specific strategy only."""
    db = get_database()
    paper_oid = ObjectId(paper_id)
    model_id = await _get_active_model_id()
    cursor = db["paper_chunks"].find({"paper_id": paper_oid, "strategy": strategy})
    chunks = await cursor.to_list(length=None)
    if not chunks:
        logger.warning(f"No chunks for paper={paper_id} strategy={strategy}")
        return
    logger.info(f"🧠 Embedding {len(chunks)} chunks (strategy={strategy}, model={model_id})")
    await _embed_and_update(chunks, model_id)


async def _embed_and_update(chunks: list, model_id: str):
    """Batch-embed chunks and bulk-write vectors back to MongoDB."""
    from pymongo import UpdateOne
    db = get_database()
    if not chunks:
        return
    contents = [c["content"] for c in chunks]
    embeddings = embed_batch(contents, model_id)
    updates = [
        UpdateOne({"_id": c["_id"]}, {"$set": {"embedding": vec, "embedding_model": model_id}})
        for c, vec in zip(chunks, embeddings)
    ]
    if updates:
        await db["paper_chunks"].bulk_write(updates)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    v = embed_text("Test sentence for embedding.")
    print(f"Default model dims: {len(v)} | sample: {v[:4]}")
