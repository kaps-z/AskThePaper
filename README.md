# AskThePaper

A Research Paper RAG (Retrieval-Augmented Generation) system. Upload academic papers, ask natural-language questions, and get grounded, citation-backed answers.

## 🚀 Quick Start

### 1. Prerequisites
- [uv](https://github.com/astral-sh/uv) (for Python 3.12+ project management)
- Node.js & npm (for the React apps)
- Docker (for local MongoDB Atlas Vector Search)

### 2. Run the Project (Docker Way — Recommended)
The fastest way to get started is using Docker. This starts the Database, Backend, and Admin Panel all at once:

```bash
docker compose up --build
```

- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Admin Panel**: [http://localhost:3000](http://localhost:3000)
- **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

For a deep dive into how Docker works in this project, check out [DOCKER_GUIDE.md](file:///home/kapil/project/personal/AskThePaper/DOCKER_GUIDE.md).

### 3. Run the Project (Manual Way)
If you prefer running without Docker (except for the DB):

1. Start the DB: `docker-compose up -d mongodb`
2. Run the convenience script:
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
