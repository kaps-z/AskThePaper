"""
chunking.py — PDF text extraction and semantic chunking logic.
=============================================================
This module handles reading PDFs and splitting them into small,
overlapping text chunks suitable for vector embedding.
"""

from datetime import datetime, timezone
import fitz  # PyMuPDF
import re
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List, Dict, Any
from app.core.database import get_database
from bson import ObjectId

def clean_text(text: str) -> str:
    """
    Remove garbage characters, null bytes, and normalize whitespace
    to ensure the text is clean for the LLM.
    """
    if not text:
        return ""
    
    # 1. Replace null bytes
    text = text.replace("\x00", "")
    
    # 2. Normalize whitespace (tabs, multiple spaces) to single space
    text = re.sub(r'[ \t]+', ' ', text)
    
    # 3. Fix hyphenated words at line breaks (common in PDFs)
    # e.g., "con- \ntinued" -> "continued"
    text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', text)
    
    return text.strip()

def extract_text_with_metadata(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract text from a PDF, preserving page numbers and cleaning text.
    Returns a list of dicts: [{"text": "...", "page": 1}, ...]

    Strategy (two-stage with fallback):
    1. Try PyMuPDF first — fast and handles most PDFs.
    2. If PyMuPDF yields very little text, fall back to pdfminer which uses
       a different parsing engine and handles some encoding edge-cases better.
    """
    pages = _extract_with_pymupdf(file_path)

    # If PyMuPDF found less than 100 chars total, try the fallback.
    total_text = sum(len(p["text"]) for p in pages)
    if total_text < 100:
        print(f"⚠️  PyMuPDF found only {total_text} chars. Trying pdfminer fallback...")
        pages_fallback = _extract_with_pdfminer(file_path)
        if sum(len(p["text"]) for p in pages_fallback) > total_text:
            pages = pages_fallback
            print("✅ pdfminer fallback succeeded.")

    return pages


def _extract_with_pymupdf(file_path: str) -> List[Dict[str, Any]]:
    """Primary extraction using PyMuPDF (fitz)."""
    doc = fitz.open(file_path)
    pages = []
    for page_num, page in enumerate(doc, start=1):
        raw_text = page.get_text("text")
        cleaned_text = clean_text(raw_text)
        if cleaned_text:
            pages.append({"text": cleaned_text, "page": page_num})
    doc.close()
    return pages


def _extract_with_pdfminer(file_path: str) -> List[Dict[str, Any]]:
    """
    Fallback extraction using pdfminer.six.
    Handles PDFs with tricky encodings that trip up PyMuPDF.
    """
    try:
        from pdfminer.high_level import extract_pages
        from pdfminer.layout import LTTextContainer
    except ImportError:
        print("⚠️  pdfminer.six not installed. Skipping fallback.")
        return []

    pages = []
    try:
        for page_num, page_layout in enumerate(extract_pages(file_path), start=1):
            page_text = []
            for element in page_layout:
                if isinstance(element, LTTextContainer):
                    page_text.append(element.get_text())
            raw = "".join(page_text)
            cleaned = clean_text(raw)
            if cleaned:
                pages.append({"text": cleaned, "page": page_num})
    except Exception as e:
        print(f"⚠️  pdfminer fallback failed: {e}")
    return pages


def chunk_pages(pages: List[Dict[str, Any]], chunk_size: int = 1000, chunk_overlap: int = 200) -> List[Dict[str, Any]]:
    """
    Split extracted pages into overlapping chunks using RecursiveCharacterTextSplitter.
    Each chunk retains its source page number and a unique index.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )

    all_chunks = []
    for page in pages:
        chunks = splitter.split_text(page["text"])
        for idx, content in enumerate(chunks):
            all_chunks.append({
                "content": content,
                "metadata": {
                    "page": page["page"],
                    "chunk_index": idx
                }
            })
    
    return all_chunks

async def store_chunks(paper_id: str, chunks: List[Dict[str, Any]]):
    """
    Store the processed chunks in the 'paper_chunks' collection.
    
    IDEMPOTENCY: This function first deletes any existing chunks for the given
    'paper_id' before inserting the new ones. This allows for safe re-processing.
    """
    db = get_database()
    paper_oid = ObjectId(paper_id)
    
    # 1. Clear existing chunks for this paper to avoid duplicates/stale data
    await db["paper_chunks"].delete_many({"paper_id": paper_oid})
    await db["raw_paper_chunks"].delete_many({"paper_id": paper_oid}) # Clear raw too
    
    # 2. Prepare chunks for insertion
    to_insert = []
    for chunk in chunks:
        doc = {
            "paper_id": paper_oid,
            "content": chunk["content"],
            "metadata": {
                **chunk["metadata"],
                "paper_id": paper_id
            }
        }
        to_insert.append(doc)
    
    # 3. Bulk insert for efficiency
    if to_insert:
        print(f"📦 Inserting {len(to_insert)} chunks for paper {paper_id}...")
        # Save to main production collection
        res1 = await db["paper_chunks"].insert_many(to_insert)
        # Also save to raw collection for auditing/checking as requested
        res2 = await db["raw_paper_chunks"].insert_many(to_insert)
        print(f"✅ inserted_ids count: {len(res1.inserted_ids)}")
    else:
        print(f"⚠️ No chunks to insert for paper {paper_id}")
        
    # 4. Update the paper status in 'admin_files'
    await db["admin_files"].update_one(
        {"_id": paper_oid},
        {"$set": {
            "status": "chunked",
            "chunks_count": len(to_insert),
            "processed_at": datetime.now(timezone.utc)
        }}
    )

if __name__ == "__main__":
    # Quick manual test if run directly
    import sys
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        print(f"🛠️ Processing: {pdf_path}")
        extracted = extract_text_with_metadata(pdf_path)
        chunks = chunk_pages(extracted)
        print(f"✅ Created {len(chunks)} chunks.")
        if chunks:
            print(f"📝 Sample chunk (Page {chunks[0]['metadata']['page']}):")
            print(f"--- CONTENT ---\n{chunks[0]['content'][:200]}...\n---------------")
