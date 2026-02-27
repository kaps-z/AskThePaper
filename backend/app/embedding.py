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
    Fetch all chunks for a paper, generate embeddings, and update them in MongoDB.
    """
    db = get_database()
    paper_oid = ObjectId(paper_id)
    
    # 1. Fetch chunks that don't have embeddings yet (or all if we want to overwrite)
    cursor = db["paper_chunks"].find({"paper_id": paper_oid})
    chunks = await cursor.to_list(length=None)
    
    if not chunks:
        logger.warning(f"⚠️ No chunks found for paper {paper_id}. Skipping embedding.")
        return
    
    logger.info(f"🧠 Generating embeddings for {len(chunks)} chunks of paper {paper_id}...")
    
    # 2. Extract contents and embed as a batch
    contents = [c["content"] for c in chunks]
    embeddings = embed_batch(contents)
    
    # 3. Update chunks with their new embeddings
    # We use bulk_write for maximum efficiency
    from pymongo import UpdateOne
    
    updates = []
    for chunk, vector in zip(chunks, embeddings):
        updates.append(
            UpdateOne(
                {"_id": chunk["_id"]},
                {"$set": {"embedding": vector}}
            )
        )
    
    if updates:
        await db["paper_chunks"].bulk_write(updates)
        
    # 4. Update the paper status to 'embedded'
    await db["admin_files"].update_one(
        {"_id": paper_oid},
        {"$set": {"status": "embedded"}}
    )
    
    logger.info(f"✅ Embedding complete for paper {paper_id}.")

if __name__ == "__main__":
    # Test initialization
    logging.basicConfig(level=logging.INFO)
    v = embed_text("This is a test of the embedding system.")
    print(f"Dimension: {len(v)}")
    print(f"Sample: {v[:5]}...")
