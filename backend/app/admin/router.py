"""
Admin Router — Endpoints for the React Admin Panel.

This file handles file uploads and simple authentication.
"""

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.auth import verify_admin
from app.core.database import get_database

router = APIRouter(tags=["Admin"])

# We'll store uploaded files here
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/login")
async def login(username: str = Depends(verify_admin)):
    """
    Login endpoint.
    
    If the `verify_admin` dependency succeeds (because the user sent
    the correct Basic Auth header), this function runs.
    We just return a success message. The frontend will know the credentials
    are valid and can store them to send with future requests.
    """
    return {"message": f"Welcome, {username}!"}


@router.post("/upload")
async def upload_paper(
    file: UploadFile = File(...),
    username: str = Depends(verify_admin)  # <-- Requires auth!
):
    """
    Upload a PDF research paper.
    
    1. Validates it's a PDF.
    2. Saves it to disk (backend/uploads/).
    3. Records metadata in MongoDB (so we know what papers exist).
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    # 1. Save file to disk
    file_path = UPLOAD_DIR / file.filename
    try:
        # We read the whole file into memory here for simplicity.
        # For huge files, chunked reading is better.
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {e}",
        )

    # 2. Record metadata in MongoDB
    db = get_database()
    paper_document = {
        "filename": file.filename,
        "filepath": str(file_path),
        "uploaded_by": username,
        "uploaded_at": datetime.now(timezone.utc),
        "status": "uploaded",  # Later we'll change this to "chunked", "embedded", etc.
    }
    
    await db["admin_files"].insert_one(paper_document)

    return {
        "message": "File uploaded successfully",
        "filename": file.filename,
        "status": "uploaded"
    }


@router.get("/files")
async def list_files(username: str = Depends(verify_admin)):
    """
    Returns a list of all uploaded papers from MongoDB.
    
    Since MongoDB's `_id` field is an ObjectId, we convert it to a
    regular string so it can be JSON structured.
    """
    db = get_database()
    # Find all documents, sort by uploaded_at descending (newest first)
    cursor = db["admin_files"].find({}).sort("uploaded_at", -1)
    
    files = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])  # Convert ObjectId to string
        files.append(doc)
        
    return files


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    username: str = Depends(verify_admin)
):
    """
    Deletes a paper from MongoDB and removes the physical PDF file.
    """
    from bson import ObjectId
    db = get_database()
    
    try:
        obj_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID format")

    # 1. Find the document to get the filepath
    paper = await db["admin_files"].find_one({"_id": obj_id})
    if not paper:
        raise HTTPException(status_code=404, detail="File not found in database")
        
    # 2. Delete the physical file from disk
    filepath = Path(paper.get("filepath", ""))
    if filepath.exists() and filepath.is_file():
        try:
            filepath.unlink()  # Deletes the file
        except Exception as e:
            # We log it but continue to delete the DB record anyway
            print(f"Warning: Could not delete physical file {filepath}: {e}")
            
    # 3. Delete from MongoDB
    await db["admin_files"].delete_one({"_id": obj_id})
    
    return {"message": "File deleted successfully", "id": file_id}


@router.post("/files/{file_id}/process")
async def process_file(
    file_id: str,
    username: str = Depends(verify_admin)
):
    """
    Triggers the chunking pipeline for a specific file.
    """
    from bson import ObjectId
    from app.chunking import extract_text_with_metadata, chunk_pages, store_chunks
    
    db = get_database()
    
    try:
        obj_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID format")

    # 1. Find the document
    paper = await db["admin_files"].find_one({"_id": obj_id})
    if not paper:
        raise HTTPException(status_code=404, detail="File not found")
        
    filepath = paper.get("filepath")
    if not filepath or not Path(filepath).exists():
        raise HTTPException(status_code=404, detail="Physical file missing on server")

    # 2. Update status to 'processing'
    await db["admin_files"].update_one(
        {"_id": obj_id},
        {"$set": {"status": "processing"}}
    )

    try:
        # 3. Extract and Chunk
        pages = extract_text_with_metadata(filepath)
        chunks = chunk_pages(pages)
        
        # 4. Store Chunks
        await store_chunks(file_id, chunks)
        
        return {
            "message": "Paper processed successfully",
            "chunks_created": len(chunks),
            "status": "chunked"
        }
    except Exception as e:
        # Revert status on failure
        await db["admin_files"].update_one(
            {"_id": obj_id},
            {"$set": {"status": "error", "error_msg": str(e)}}
        )
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")


from pydantic import BaseModel

class ConfigUpdate(BaseModel):
    chunking: str
    embedding: str
    evaluation: str

@router.get("/config")
async def get_config(username: str = Depends(verify_admin)):
    """
    Fetches the global system configuration from MongoDB.
    """
    db = get_database()
    config = await db["system_config"].find_one({"_id": "global_config"})
    
    if not config:
        raise HTTPException(
            status_code=404, 
            detail="System configuration not found. Have you run the seeder script?"
        )
        
    return config

@router.put("/config")
async def update_config(
    update_data: ConfigUpdate,
    username: str = Depends(verify_admin)
):
    """
    Updates the active strategies in the global system configuration.
    """
    db = get_database()
    
    # Using $set to update just the 'active' fields inside the embedded documents
    result = await db["system_config"].update_one(
        {"_id": "global_config"},
        {"$set": {
            "chunking.active": update_data.chunking,
            "embedding.active": update_data.embedding,
            "evaluation.active": update_data.evaluation
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="System configuration not found.")
        
    return {"message": "Configuration updated successfully"}

