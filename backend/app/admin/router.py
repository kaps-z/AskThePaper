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

    # 2. Record metadata in MongoDB first to get a unique ID
    db = get_database()
    
    # Simple title: filename without extension
    title = file.filename.rsplit(".", 1)[0].replace("_", " ").title()
    
    paper_document = {
        "filename": file.filename,
        "title": title,
        "uploaded_by": username,
        "uploaded_at": datetime.now(timezone.utc),
        "status": "uploaded",
    }
    
    result = await db["admin_files"].insert_one(paper_document)
    file_id = str(result.inserted_id)

    # 3. Save file to disk with unique name (ID + sanitized Title)
    safe_title = "".join([c if c.isalnum() or c in "-_" else "_" for c in title.replace(" ", "_")])
    unique_filename = f"{file_id}_{safe_title}.pdf"
    file_path = UPLOAD_DIR / unique_filename

    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
            
        # 4. Update document with the final filepath
        await db["admin_files"].update_one(
            {"_id": result.inserted_id},
            {"$set": {"filepath": str(file_path)}}
        )
    except Exception as e:
        # Cleanup if saving fails
        await db["admin_files"].delete_one({"_id": result.inserted_id})
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {e}",
        )

    return {
        "id": file_id,
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
        # Fallback for older files that don't have the 'title' field
        if "title" not in doc:
            filename = doc.get("filename", "unknown.pdf")
            doc["title"] = filename.rsplit(".", 1)[0].replace("_", " ").title()
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


@router.get("/files/{file_id}/chunks")
async def get_paper_chunks(
    file_id: str,
    username: str = Depends(verify_admin)
):
    """
    Returns all chunks associated with a specific paper.
    """
    from bson import ObjectId
    db = get_database()
    
    try:
        obj_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID format")
        
    cursor = db["paper_chunks"].find({"paper_id": obj_id}).sort("metadata.chunk_index", 1)
    chunks = await cursor.to_list(length=None)
    
    for c in chunks:
        c["_id"] = str(c["_id"])
        c["paper_id"] = str(c["paper_id"])
        
    return chunks


@router.delete("/files/{file_id}/chunks")
async def delete_paper_chunks(
    file_id: str,
    username: str = Depends(verify_admin)
):
    """
    Deletes all chunks and embeddings for a paper and resets its status.
    """
    from bson import ObjectId
    db = get_database()
    
    try:
        obj_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID format")
        
    # 1. Delete the chunks
    await db["paper_chunks"].delete_many({"paper_id": obj_id})
    await db["raw_paper_chunks"].delete_many({"paper_id": obj_id})
    
    # 2. Reset the paper status
    await db["admin_files"].update_one(
        {"_id": obj_id},
        {"$set": {"status": "uploaded", "chunks_count": 0}}
    )
    
    return {"message": "Chunks and embeddings cleared", "id": file_id}


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
    from app.embedding import embed_paper_chunks
    
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
        raise HTTPException(
            status_code=404,
            detail=(
                "The PDF file was not found on the server. This usually happens when the "
                "Docker container was restarted without a persistent volume for uploads. "
                "Please delete this record and re-upload the file."
            )
        )

    # 2. Update status to 'processing'
    await db["admin_files"].update_one(
        {"_id": obj_id},
        {"$set": {"status": "processing"}}
    )

    try:
        # 3. Extract and Chunk
        chunking_model = "RecursiveCharacterTextSplitter (LangChain)"
        try:
            pages = extract_text_with_metadata(filepath)
            if not pages:
                raise ValueError(
                    "No readable text could be extracted from this PDF. "
                    "The file may be a scanned image-only document (not OCR'd), "
                    "or it may be password-protected or corrupted. "
                    "Try running OCR on the PDF first (e.g. with Adobe Acrobat or ocrmypdf)."
                )
                
            chunks = chunk_pages(pages)
            if not chunks:
                raise ValueError("PDF content resulted in zero chunks after splitting. Check the file content.")
            
            # 4. Store Chunks
            await store_chunks(file_id, chunks)
        except Exception as e:
            raise ValueError(f"Chunking Failed ({chunking_model}): {e}")

        # 5. Generate Embeddings (Milestone 4)
        embedding_model = "all-MiniLM-L6-v2 (SentenceTransformers)"
        try:
            await embed_paper_chunks(file_id)
        except Exception as e:
            raise ValueError(f"Embedding Failed ({embedding_model}): {e}")
            
        # 6. Final Status Update with Metadata
        await db["admin_files"].update_one(
            {"_id": obj_id},
            {"$set": {
                "status": "embedded",
                "chunking_model": chunking_model,
                "embedding_model": embedding_model,
                "processed_at": datetime.now(timezone.utc)
            }}
        )
        
        return {
            "message": "Paper processed successfully",
            "pages_extracted": len(pages),
            "chunks_created": len(chunks),
            "status": "embedded",
            "models": {
                "chunking": chunking_model,
                "embedding": embedding_model
            }
        }
    except Exception as e:
        # Capture error and update DB so UI can show it
        error_detail = str(e)
        await db["admin_files"].update_one(
            {"_id": obj_id},
            {"$set": {"status": "error", "error_msg": error_detail}}
        )
        raise HTTPException(status_code=500, detail=error_detail)


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

