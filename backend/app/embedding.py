"""
embedding.py — Vector embedding generation for text chunks.
==========================================================
This module converts text chunks into high-dimensional vectors
that can be used for semantic search in MongoDB.
"""

import logging
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
from app.core.database import get_database
from bson import ObjectId

# Initialize logging
logger = logging.getLogger(__name__)

# Use a standard, efficient embedding model
# 'all-MiniLM-L6-v2' is small, fast, and great for general purpose semantic search.
MODEL_NAME = "all-MiniLM-L6-v2"
model = None

def get_model():
    """Lazy load the model to save memory during startup if not needed."""
    global model
    if model is None:
        logger.info(f"💾 Loading embedding model: {MODEL_NAME}...")
        model = SentenceTransformer(MODEL_NAME)
        logger.info("✅ Model loaded.")
    return model

def embed_text(text: str) -> List[float]:
    """Generate a vector for a single string."""
    m = get_model()
    # convert to list as SentenceTransformer returns numpy array
    return m.encode(text).tolist()

def embed_batch(texts: List[str]) -> List[List[float]]:
    """Generate vectors for a batch of strings efficiently."""
    m = get_model()
    return m.encode(texts).tolist()

async def embed_paper_chunks(paper_id: str):
    """
    Fetch all chunks for a paper (all strategies), generate embeddings, and update them.
    """
    db = get_database()
    paper_oid = ObjectId(paper_id)
    cursor = db["paper_chunks"].find({"paper_id": paper_oid})
    chunks = await cursor.to_list(length=None)
    await _embed_and_update(chunks, paper_id)
    await db["admin_files"].update_one(
        {"_id": paper_oid},
        {"$set": {"status": "embedded"}}
    )
    logger.info(f"✅ Embedding complete for paper {paper_id}.")


async def embed_paper_chunks_for_strategy(paper_id: str, strategy: str):
    """
    Generate embeddings only for chunks of a specific strategy.
    Used by the multi-strategy orchestrator in chunking.py.
    """
    db = get_database()
    paper_oid = ObjectId(paper_id)
    cursor = db["paper_chunks"].find({"paper_id": paper_oid, "strategy": strategy})
    chunks = await cursor.to_list(length=None)
    if not chunks:
        logger.warning(f"⚠️ No chunks found for paper {paper_id} strategy='{strategy}'.")
        return
    logger.info(f"🧠 Embedding {len(chunks)} chunks (strategy={strategy}) for paper {paper_id}...")
    await _embed_and_update(chunks, paper_id)


async def _embed_and_update(chunks, paper_id: str):
    """Shared helper: batch-embed a list of chunks and write vectors back to MongoDB."""
    from pymongo import UpdateOne
    db = get_database()

    if not chunks:
        return

    contents = [c["content"] for c in chunks]
    embeddings = embed_batch(contents)

    updates = [
        UpdateOne({"_id": chunk["_id"]}, {"$set": {"embedding": vector}})
        for chunk, vector in zip(chunks, embeddings)
    ]
    if updates:
        await db["paper_chunks"].bulk_write(updates)

if __name__ == "__main__":
    # Test initialization
    logging.basicConfig(level=logging.INFO)
    v = embed_text("This is a test of the embedding system.")
    print(f"Dimension: {len(v)}")
    print(f"Sample: {v[:5]}...")
