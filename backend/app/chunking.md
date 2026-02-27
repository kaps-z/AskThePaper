# Chunking Module (`chunking.py`)

This module is responsible for the first stage of the RAG pipeline: converting raw PDF files into manageable text chunks.

## Why Chunking?
LLMs have finite context windows. Breaking a large research paper into smaller chunks ensures:
1. We only send relevant context to the LLM (cost & latency).
2. We stay within token limits.
3. Retrieval is more precise.

## Implementation Details
- **Library**: `PyMuPDF` (fitz) for high-speed, reliable PDF parsing.
- **Strategy**: `RecursiveCharacterTextSplitter` from LangChain.
- **Overlapping**: We use an overlap (e.g., 200 characters) to ensure semantic context is preserved across chunk boundaries.

## Functions
- `extract_text_from_pdf(file_path)`: Uses PyMuPDF to extract text page-by-page.
- `create_chunks(text, chunk_size, chunk_overlap)`: Splits text into overlapping segments.
- `process_paper(file_path)`: Orchestrates the full chunking pipeline for a single paper.

## Design Decisions
We chose `PyMuPDF` over other Parsers (like `pypdf`) because it is significantly faster and handles complex academic layouts (multi-column) more gracefully.
