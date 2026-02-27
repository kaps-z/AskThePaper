# Embedding Module (`embedding.py`)

This module is responsible for converting text chunks into dense vector representations (embeddings) that enable semantic search.

## Why Embeddings?
Search by keywords (like Ctrl+F) fails if the user uses synonyms or different phrasing. Embeddings represent the **meaning** of the text as a list of numbers (a vector). Chunks with similar meanings will have vectors that are "close" to each other in mathematical space.

## Implementation Details
- **Library**: `SentenceTransformers` (HuggingFace).
- **Model**: `all-MiniLM-L6-v2`.
  - Dimensions: 384
  - Speed: Extremely fast on CPU.
  - Quality: High for general academic and technical text.
- **Storage**: Vectors are stored in the `embedding` field of documents in the `paper_chunks` collection.

## Functions
- `get_model()`: Lazy-loads the HuggingFace model into memory.
- `embed_text(text)`: Generates a vector for a single string.
- `embed_batch(texts)`: Efficiently generates vectors for many strings at once using batch processing.
- `embed_paper_chunks(paper_id)`: Orchestrates the transformation of all chunks of a paper into vectors and saves them to MongoDB.

## Design Decisions
We chose `SentenceTransformers` over the OpenAI API for this phase to ensure the system is **self-contained** and doesn't require an external API key or internet connection for basic vector generation. It also makes the Docker setup more portable.
