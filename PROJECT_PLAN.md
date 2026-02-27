# AskThePaper — Project Plan

> A **Research Paper RAG (Retrieval-Augmented Generation)** system that lets users upload academic papers, ask natural-language questions, and get grounded, citation-backed answers.

---

## 1. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Backend API** | FastAPI (Python 3.12+) | Async, auto-docs (Swagger), type-safe |
| **Package Manager** | `uv` | Lightning-fast Python dependency management |
| **Database** | MongoDB Atlas | Native vector search + flexible document model |
| **Embeddings** | OpenAI / Sentence-Transformers | High-quality semantic embeddings |
| **LLM** | OpenAI GPT-4 (or equivalent) | Reasoning & answer generation |
| **Frontend (QA)** | React + Vite | Fast dev experience, component-based UI |
| **Admin Panel** | React + Vite | CRM for managing papers, chunks, and history |

---

## 2. Architecture

```
AskThePaper/
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── main.py         # Entry point, CORS, routes
│   │   ├── chunking.py     # PDF → text → chunks
│   │   ├── embedding.py    # Chunks → vector embeddings
│   │   ├── retrieval.py    # Query → relevant chunks (vector search)
│   │   ├── prompting.py    # Build LLM prompts from context
│   │   ├── evaluation.py   # RAGAS / custom eval metrics
│   │   └── *.md            # Explanatory docs for each module
│   ├── pyproject.toml
│   └── .venv/
├── frontend/               # React app — user-facing Q&A
│   ├── src/
│   └── package.json
├── admin/                  # React app — admin CRM panel
│   ├── src/
│   └── package.json
└── PROJECT_PLAN.md         # ← You are here
```

---

## 3. Backend Modules (Deep Dive)

### `chunking.py`
- Parse PDFs (PyMuPDF / pdfplumber).
- Split text into overlapping chunks (configurable size & overlap).
- Store chunks in MongoDB with metadata (paper title, page no., chunk index).

### `embedding.py`
- Generate vector embeddings for each chunk.
- Support swappable embedding models (OpenAI, HuggingFace).
- Batch processing for efficiency.

### `retrieval.py`
- Accept a user query, embed it, and perform **MongoDB Atlas Vector Search**.
- Return top-k relevant chunks with similarity scores.

### `prompting.py`
- Build a grounded prompt from retrieved chunks + user question.
- Enforce citation format so the LLM references specific chunks.

### `evaluation.py`
- Compute RAG quality metrics: **faithfulness**, **answer relevancy**, **context precision**.
- Optional RAGAS integration for automated evaluation.

---

## 4. Frontend Features

| Feature | Description |
|---------|-------------|
| **Q&A Mode** | Ask questions about uploaded papers, see answers with citations |
| **Search Mode** | Semantic search across all ingested papers |
| **Debug / Eval Mode** | View retrieved chunks, similarity scores, and evaluation metrics |

---

## 5. Admin Panel Features

| Feature | Description |
|---------|-------------|
| **File Uploads** | Upload PDFs, trigger chunking & embedding pipeline |
| **Paper Management** | View, delete, re-process papers |
| **Chat History** | Browse and manage stored Q&A conversations |
| **Pipeline Status** | Monitor ingestion progress and errors |

---

## 6. Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Project Plan + Backend Init + FastAPI Health Check | [x] Completed |
| 2 | MongoDB connection + Config management | [x] Completed |
| 3 | `chunking.py` — PDF parsing & chunk storage | [x] Completed |
| 4 | `embedding.py` — Vector embedding generation | [x] Completed |
| 4.5 | Admin Navbar and Pipeline Configuration | ⬜ Planned |
| 5 | `retrieval.py` — Vector search retrieval | ⬜ Planned |
| 6 | `prompting.py` — LLM prompt construction | ⬜ Planned |
| 7 | `evaluation.py` — RAG evaluation metrics | ⬜ Planned |
| 8 | Frontend (React) — Q&A + Search UI | ⬜ Planned |
| 9 | Admin Panel (React) — Upload + Management UI | [x] Completed |
| 10 | End-to-end integration & testing | ⬜ Planned |

---

## 7. Documentation Philosophy

> **Every `.py` file gets a companion `.md` file** in the same directory explaining:
> - What the module does
> - Key packages used and why
> - Function-by-function breakdown
> - Design decisions and trade-offs

This ensures the project doubles as a **learning resource**, not just code.
