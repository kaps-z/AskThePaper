"""
chunking.py — PDF text extraction and multi-strategy semantic chunking.
=======================================================================
Supports three chunking strategies, each producing tagged chunks that are
stored independently in MongoDB so they can be compared and evaluated.

Strategies
----------
- recursive  : LangChain RecursiveCharacterTextSplitter (handles most PDFs well).
- sentence   : Splits on sentence boundaries, respects natural language flow.
- paragraph  : Splits on double-newlines (section/paragraph breaks in academic papers).
"""

from datetime import datetime, timezone
import fitz  # PyMuPDF
import re
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List, Dict, Any, Optional
from app.core.database import get_database
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

# ─── Available chunking strategies ────────────────────────────────────────────
AVAILABLE_STRATEGIES = ["recursive", "sentence", "paragraph", "semantic"]


# ─── Text Cleaning ─────────────────────────────────────────────────────────────
def clean_text(text: str) -> str:
    """Remove garbage characters and normalize whitespace."""
    if not text:
        return ""
    text = text.replace("\x00", "")
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', text)
    return text.strip()


# ─── PDF Extraction ────────────────────────────────────────────────────────────
def extract_text_with_metadata(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract text from a PDF using PyMuPDF with pdfminer fallback.
    Returns: [{"text": "...", "page": 1}, ...]
    """
    pages = _extract_with_pymupdf(file_path)
    total_text = sum(len(p["text"]) for p in pages)
    if total_text < 100:
        logger.warning(f"PyMuPDF found only {total_text} chars. Trying pdfminer fallback...")
        pages_fallback = _extract_with_pdfminer(file_path)
        if sum(len(p["text"]) for p in pages_fallback) > total_text:
            pages = pages_fallback
            logger.info("pdfminer fallback succeeded.")
    return pages


def _extract_with_pymupdf(file_path: str) -> List[Dict[str, Any]]:
    """Primary extraction using PyMuPDF (fitz)."""
    doc = fitz.open(file_path)
    pages = []
    for page_num, page in enumerate(doc, start=1):
        raw_text = page.get_text("text")
        cleaned = clean_text(raw_text)
        if cleaned:
            pages.append({"text": cleaned, "page": page_num})
    doc.close()
    return pages


def _extract_with_pdfminer(file_path: str) -> List[Dict[str, Any]]:
    """Fallback extraction using pdfminer.six for tricky encodings."""
    try:
        from pdfminer.high_level import extract_pages
        from pdfminer.layout import LTTextContainer
    except ImportError:
        logger.warning("pdfminer.six not installed. Skipping fallback.")
        return []

    pages = []
    try:
        for page_num, page_layout in enumerate(extract_pages(file_path), start=1):
            page_text = []
            for element in page_layout:
                if isinstance(element, LTTextContainer):
                    page_text.append(element.get_text())
            cleaned = clean_text("".join(page_text))
            if cleaned:
                pages.append({"text": cleaned, "page": page_num})
    except Exception as e:
        logger.warning(f"pdfminer fallback failed: {e}")
    return pages


# ─── Chunking Strategies ───────────────────────────────────────────────────────
def chunk_by_recursive(pages: List[Dict[str, Any]], chunk_size: int = 1000, chunk_overlap: int = 200) -> List[Dict[str, Any]]:
    """
    Strategy: RecursiveCharacterTextSplitter.
    Splits on paragraph → sentence → word boundaries in order.
    Best general-purpose strategy.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = []
    for page in pages:
        for idx, content in enumerate(splitter.split_text(page["text"])):
            chunks.append({
                "content": content,
                "strategy": "recursive",
                "metadata": {"page": page["page"], "chunk_index": idx}
            })
    return chunks


def chunk_by_sentence(pages: List[Dict[str, Any]], target_size: int = 800) -> List[Dict[str, Any]]:
    """
    Strategy: Sentence-boundary chunking.
    Splits text into individual sentences, then merges them into groups
    until we reach ~target_size characters. Preserves natural language flow.
    Good for papers with dense prose.
    """
    sentence_end = re.compile(r'(?<=[.!?])\s+')

    chunks = []
    for page in pages:
        sentences = sentence_end.split(page["text"])
        current_chunk = []
        current_len = 0
        chunk_idx = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            if current_len + len(sentence) > target_size and current_chunk:
                chunks.append({
                    "content": " ".join(current_chunk),
                    "strategy": "sentence",
                    "metadata": {"page": page["page"], "chunk_index": chunk_idx}
                })
                chunk_idx += 1
                current_chunk = []
                current_len = 0
            current_chunk.append(sentence)
            current_len += len(sentence)

        # Flush remainder
        if current_chunk:
            chunks.append({
                "content": " ".join(current_chunk),
                "strategy": "sentence",
                "metadata": {"page": page["page"], "chunk_index": chunk_idx}
            })
    return chunks


def chunk_by_paragraph(pages: List[Dict[str, Any]], min_size: int = 200, max_size: int = 1500) -> List[Dict[str, Any]]:
    """
    Strategy: Paragraph/section-boundary chunking.
    Splits on double-newline (natural section breaks in academic papers).
    Short paragraphs are merged with the next; overly long ones are split.
    Best for structured papers with clear section headings.
    """
    chunks = []
    for page in pages:
        paragraphs = re.split(r'\n\n+', page["text"])
        current_chunk = []
        current_len = 0
        chunk_idx = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If the current paragraph alone exceeds max_size, split it
            if len(para) > max_size:
                if current_chunk:
                    chunks.append({
                        "content": "\n\n".join(current_chunk),
                        "strategy": "paragraph",
                        "metadata": {"page": page["page"], "chunk_index": chunk_idx}
                    })
                    chunk_idx += 1
                    current_chunk = []
                    current_len = 0
                # Split the oversized paragraph into fixed chunks
                for i in range(0, len(para), max_size):
                    chunks.append({
                        "content": para[i:i + max_size],
                        "strategy": "paragraph",
                        "metadata": {"page": page["page"], "chunk_index": chunk_idx}
                    })
                    chunk_idx += 1
                continue

            if current_len + len(para) > max_size and current_len >= min_size:
                chunks.append({
                    "content": "\n\n".join(current_chunk),
                    "strategy": "paragraph",
                    "metadata": {"page": page["page"], "chunk_index": chunk_idx}
                })
                chunk_idx += 1
                current_chunk = []
                current_len = 0

            current_chunk.append(para)
            current_len += len(para)

        if current_chunk:
            chunks.append({
                "content": "\n\n".join(current_chunk),
                "strategy": "paragraph",
                "metadata": {"page": page["page"], "chunk_index": chunk_idx}
            })
    return chunks


# ─── Dispatcher ────────────────────────────────────────────────────────────────
def chunk_by_semantic(pages: List[Dict[str, Any]], threshold: float = 0.4, max_chunk_size: int = 1200) -> List[Dict[str, Any]]:
    """
    Strategy: Semantic / topic-boundary chunking.
    Embeds each sentence using SentenceTransformers and detects topic shifts
    via cosine-similarity drops between consecutive sentence embeddings.
    Sentences after a breakpoint start a new chunk.
    This is the most intelligent strategy — it finds natural topic changes
    rather than arbitrary character/word boundaries.
    """
    import numpy as np
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")
    sentence_end = re.compile(r'(?<=[.!?])\s+')

    chunks = []
    for page in pages:
        sentences = [s.strip() for s in sentence_end.split(page["text"]) if s.strip()]
        if not sentences:
            continue

        # Embed all sentences in one batch
        embeddings = model.encode(sentences, batch_size=64, show_progress_bar=False)

        # Cosine similarity between consecutive sentences
        def cosine_sim(a, b):
            return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))

        breakpoints = set()
        for i in range(1, len(sentences)):
            sim = cosine_sim(embeddings[i - 1], embeddings[i])
            if sim < threshold:
                breakpoints.add(i)

        # Build chunks from breakpoint boundaries
        current = []
        current_len = 0
        chunk_idx = 0

        for i, sentence in enumerate(sentences):
            if i in breakpoints and current and current_len >= 100:
                chunks.append({
                    "content": " ".join(current),
                    "strategy": "semantic",
                    "metadata": {"page": page["page"], "chunk_index": chunk_idx}
                })
                chunk_idx += 1
                current = []
                current_len = 0

            # Hard split if accumulated chunk exceeds max_chunk_size
            if current_len + len(sentence) > max_chunk_size and current:
                chunks.append({
                    "content": " ".join(current),
                    "strategy": "semantic",
                    "metadata": {"page": page["page"], "chunk_index": chunk_idx}
                })
                chunk_idx += 1
                current = []
                current_len = 0

            current.append(sentence)
            current_len += len(sentence)

        if current:
            chunks.append({
                "content": " ".join(current),
                "strategy": "semantic",
                "metadata": {"page": page["page"], "chunk_index": chunk_idx}
            })

    return chunks


def get_chunks_for_strategy(strategy: str, pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Route a strategy name to the correct chunking function."""
    if strategy == "recursive":
        return chunk_by_recursive(pages)
    elif strategy == "sentence":
        return chunk_by_sentence(pages)
    elif strategy == "paragraph":
        return chunk_by_paragraph(pages)
    elif strategy == "semantic":
        return chunk_by_semantic(pages)
    else:
        raise ValueError(f"Unknown strategy: '{strategy}'. Choose from: {AVAILABLE_STRATEGIES}")


# ─── Storage ───────────────────────────────────────────────────────────────────
async def store_chunks(paper_id: str, chunks: List[Dict[str, Any]], strategy: Optional[str] = None):
    """
    Store chunks for a given paper (and optionally a specific strategy).
    IDEMPOTENT: clears existing chunks for this paper+strategy before inserting.
    """
    db = get_database()
    paper_oid = ObjectId(paper_id)

    delete_filter: Dict[str, Any] = {"paper_id": paper_oid}
    if strategy:
        delete_filter["strategy"] = strategy

    await db["paper_chunks"].delete_many(delete_filter)

    if not chunks:
        logger.warning(f"No chunks to insert for paper {paper_id} / strategy={strategy}")
        return

    to_insert = [
        {
            "paper_id": paper_oid,
            "content": c["content"],
            "strategy": c.get("strategy", strategy or "unknown"),
            "metadata": {**c["metadata"], "paper_id": paper_id},
        }
        for c in chunks
    ]

    await db["paper_chunks"].insert_many(to_insert)
    logger.info(f"Inserted {len(to_insert)} chunks (strategy={strategy}) for paper {paper_id}.")


# ─── Orchestrator ──────────────────────────────────────────────────────────────
async def run_strategies(paper_id: str, filepath: str, strategy_names: List[str]):
    """
    Run one or more chunking + embedding strategies for a paper.
    Updates admin_files with per-strategy stats.
    This is designed to be called as a FastAPI BackgroundTask.
    """
    from app.embedding import embed_paper_chunks_for_strategy

    db = get_database()
    paper_oid = ObjectId(paper_id)

    logger.info(f"📄 Starting pipeline for paper {paper_id} with strategies: {strategy_names}")

    # 1. Mark as processing
    await db["admin_files"].update_one(
        {"_id": paper_oid},
        {"$set": {"status": "processing", "strategy_stats": {}}}
    )

    try:
        # 2. Extract text once (shared across all strategies)
        pages = extract_text_with_metadata(filepath)
        if not pages:
            raise ValueError(
                "No readable text could be extracted from this PDF. "
                "The file may be image-only (not OCR'd), password-protected, or corrupted. "
                "Try running OCR first (e.g. ocrmypdf)."
            )

        strategy_stats = {}

        for strategy in strategy_names:
            logger.info(f"  ▶ Running strategy: {strategy}")
            chunks = get_chunks_for_strategy(strategy, pages)
            await store_chunks(paper_id, chunks, strategy)
            await embed_paper_chunks_for_strategy(paper_id, strategy)
            strategy_stats[strategy] = len(chunks)
            logger.info(f"  ✅ {strategy}: {len(chunks)} chunks embedded.")

        # 3. Final status update with all strategy stats
        total_chunks = sum(strategy_stats.values())
        await db["admin_files"].update_one(
            {"_id": paper_oid},
            {"$set": {
                "status": "embedded",
                "strategy_stats": strategy_stats,
                "chunks_count": total_chunks,
                "active_strategies": strategy_names,
                "processed_at": datetime.now(timezone.utc)
            }}
        )
        logger.info(f"✅ Pipeline complete for paper {paper_id}. Total chunks: {total_chunks}")

    except Exception as e:
        error_detail = str(e)
        logger.error(f"❌ Pipeline failed for paper {paper_id}: {error_detail}")
        await db["admin_files"].update_one(
            {"_id": paper_oid},
            {"$set": {"status": "error", "error_msg": error_detail}}
        )
