"""
chunking.py — PDF text extraction and semantic chunking logic.
=============================================================
This module handles reading PDFs and splitting them into small,
overlapping text chunks suitable for vector embedding.
"""

import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List, Dict, Any

def extract_text_with_metadata(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract text from a PDF, preserving page numbers.
    Returns a list of dicts: [{"text": "...", "page": 1}, ...]
    """
    doc = fitz.open(file_path)
    pages = []
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text")
        pages.append({"text": text, "page": page_num})
    doc.close()
    return pages

def chunk_pages(pages: List[Dict[str, Any]], chunk_size: int = 1000, chunk_overlap: int = 200) -> List[Dict[str, Any]]:
    """
    Split extracted pages into overlapping chunks using RecursiveCharacterTextSplitter.
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
    Each chunk is linked to the paper via 'paper_id'.
    """
    from app.core.database import get_database
    from bson import ObjectId
    
    db = get_database()
    
    # 1. Prepare chunks for insertion
    to_insert = []
    for chunk in chunks:
        to_insert.append({
            "paper_id": ObjectId(paper_id),
            "content": chunk["content"],
            "metadata": chunk["metadata"]
        })
    
    # 2. Bulk insert for efficiency
    if to_insert:
        await db["paper_chunks"].insert_many(to_insert)
        
    # 3. Update the paper status in 'admin_files'
    await db["admin_files"].update_one(
        {"_id": ObjectId(paper_id)},
        {"$set": {"status": "chunked"}}
    )

if __name__ == "__main__":
    # Quick manual test if run directly
    import sys
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        print(f"Processing: {pdf_path}")
        extracted = extract_text_with_metadata(pdf_path)
        chunks = chunk_pages(extracted)
        print(f"Created {len(chunks)} chunks.")
        if chunks:
            print(f"Sample chunk: {chunks[0]}")
