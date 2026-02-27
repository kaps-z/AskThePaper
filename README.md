# AskThePaper

A Research Paper RAG (Retrieval-Augmented Generation) system. Upload academic papers, ask natural-language questions, and get grounded, citation-backed answers.

## 🚀 Quick Start

### 1. Prerequisites
- [uv](https://github.com/astral-sh/uv) (for Python 3.12+ project management)
- Node.js & npm (for the React apps)
- Docker (for local MongoDB Atlas Vector Search)

### 2. Database Setup
Start a local MongoDB Atlas instance with Vector Search support:
```bash
docker-compose up -d
```

Seed the system configuration (embedding/chunking models):
```bash
cd backend
uv run scripts/seed_db.py
cd ..
```

### 3. Run the Project
Use the convenience script to start both the **Backend** and **Admin Panel** at once:
```bash
chmod +x run_dev.sh
./run_dev.sh
```

- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Admin Panel**: [http://localhost:3000](http://localhost:3000)
- **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🏗️ Project Structure

- `backend/`: FastAPI application.
- `admin/`: React + Vite admin CRM for managing papers and pipeline.
- `frontend/`: React + Vite user-facing Q&A interface (In Progress).

## 🛠️ Tech Stack
- **Backend**: FastAPI, Motor (Async MongoDB), pydantic-settings, PyMuPDF (chunking).
- **Database**: MongoDB Atlas (Vector Search enabled).
- **Frontend/Admin**: React, Vite, Axios.
- **Workflow**: `uv` for lightning-fast Python dependency management.
