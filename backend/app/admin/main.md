# Admin API — Explanatory Doc

## What This Module Does

This module provides two endpoints for managing the RAG system's knowledge base:
1. `POST /admin/login`: Verifies user credentials.
2. `POST /admin/upload`: Receives a research paper PDF and records metadata in MongoDB.

---

## The `verify_admin` Dependency (`core/auth.py`)

```python
def verify_admin(credentials: HTTPBasicCredentials = Depends(security)) -> str:
```

### What is a FastAPI "Dependency"?
A dependency is a function that runs **before** your endpoint. It's FastAPI's way of sharing logic.
If an endpoint has `Depends(verify_admin)`, it means:
> *"Before running this endpoint, run `verify_admin`. If it raises an HTTP exception (e.g., 401 Unauthorized), stop immediately and return that error to the user. If it succeeds, pass its return value into the endpoint."*

### Why `secrets.compare_digest`?
When checking passwords, if you use `==`, python compares characters one by one and stops at the first mismatch. An attacker can measure how long the check takes to figure out if they got the first letter right (a "Timing Attack"). `compare_digest` takes the exact same amount of time regardless of whether the password is right or wrong.

---

## File Upload Endpoint (`admin/router.py`)

```python
@router.post("/upload")
async def upload_paper(
    file: UploadFile = File(...),
    username: str = Depends(verify_admin)
):
```

1. **`UploadFile`**: FastAPI's wrapper for uploaded files. It saves the file to a temporary location on disk to avoid using up too much RAM if the user uploads a 1GB file.
2. **Metadata Storage**: We construct a dictionary `paper_document` and insert it into the `"admin_files"` MongoDB collection:
   ```python
   await db["admin_files"].insert_one(paper_document)
   ```
   *Notice the `await`. This is a Motor async database call!*

---

## Testing with `curl`

To test these endpoints from the terminal:

### 1. Test Login
```bash
# Correct credentials:
curl -X POST http://localhost:8000/admin/login -u "admin:changeme"

# Wrong credentials (returns 401 Unauthorized):
curl -X POST http://localhost:8000/admin/login -u "admin:wrongpassword"
```

### 2. Test Upload
```bash
# Requires an actual file named some_paper.pdf in the current folder:
touch dummy.pdf
curl -X POST http://localhost:8000/admin/upload -u "admin:changeme" -F "file=@dummy.pdf"
```
