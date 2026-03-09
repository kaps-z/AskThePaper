"""
Admin Router — Endpoints for the React Admin Panel.
Handles file uploads, pipeline processing, config management.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.core.auth import verify_admin
from app.core.database import get_database
from app.chunking import AVAILABLE_STRATEGIES, run_strategies
from app.llm import LLM_CATALOGUE, ALL_MODEL_IDS, DEFAULT_MODEL
from app.embedding import EMBEDDING_MODELS, DEFAULT_MODEL_ID as DEFAULT_EMBED_MODEL
from app.evaluation import DEFAULT_EVALUATION_CONFIG

router = APIRouter(tags=["Admin"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ─── Default config (auto-seeded if not found) ────────────────────────────────
DEFAULT_CONFIG = {
    "_id": "global_config",
    "chunking": {
        "active_strategies": AVAILABLE_STRATEGIES,
        "options": AVAILABLE_STRATEGIES
    },
    "embedding": {
        "active": DEFAULT_EMBED_MODEL,
        "options": list(EMBEDDING_MODELS.keys())
    },
    "llm": {
        "active_model": DEFAULT_MODEL,
        "catalogue": LLM_CATALOGUE,
    },
    "evaluation": DEFAULT_EVALUATION_CONFIG,
    "debug_mode": False,       # show retrieval debug info in chat
    "chat_enabled": True,      # kill-switch for the chat frontend
    "frontend_settings": {
        "visible_strategies": AVAILABLE_STRATEGIES,
        "visible_models": []   # Empty = all visible
    }
}


async def _get_or_seed_config(db) -> dict:
    """Return the config document, auto-seeding defaults if not present."""
    config = await db["system_config"].find_one({"_id": "global_config"})
    if not config:
        await db["system_config"].insert_one(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()

    # FORCE updates for existing config to match user's request
    updates = {}
    current_strategies = config.get("chunking", {}).get("active_strategies", [])
    if len(current_strategies) < len(AVAILABLE_STRATEGIES):
        updates["chunking.active_strategies"] = AVAILABLE_STRATEGIES
    if not config.get("frontend_settings"):
        updates["frontend_settings"] = DEFAULT_CONFIG["frontend_settings"]
    if "llm" not in config or "catalogue" not in config["llm"]:
        updates["llm.catalogue"] = DEFAULT_CONFIG["llm"]["catalogue"]
    
    # Ensure these booleans exist and aren't stuck in an old state
    if "debug_mode" not in config:
        updates["debug_mode"] = DEFAULT_CONFIG["debug_mode"]
    if "chat_enabled" not in config:
        updates["chat_enabled"] = DEFAULT_CONFIG["chat_enabled"]
        
    if updates:
        await db["system_config"].update_one({"_id": "global_config"}, {"$set": updates})
        # Merge updates into the local config object so the response is correct immediately
        for k, v in updates.items():
            if '.' in k:
                parent, child = k.split('.')
                config[parent][child] = v
            else:
                config[k] = v
    return config


# ─── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login")
async def login(username: str = Depends(verify_admin)):
    return {"message": f"Welcome, {username}!"}


# ─── Upload ────────────────────────────────────────────────────────────────────
@router.post("/upload")
async def upload_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    username: str = Depends(verify_admin),
):
    """
    Upload a PDF and auto-trigger the chunking pipeline as a background task.
    The frontend can poll GET /files to watch the status change:
    uploaded → processing → embedded (or error).
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    db = get_database()

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

    safe_title = "".join([c if c.isalnum() or c in "-_" else "_" for c in title.replace(" ", "_")])
    unique_filename = f"{file_id}_{safe_title}.pdf"
    file_path = UPLOAD_DIR / unique_filename

    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        await db["admin_files"].update_one(
            {"_id": result.inserted_id},
            {"$set": {"filepath": str(file_path)}}
        )
    except Exception as e:
        await db["admin_files"].delete_one({"_id": result.inserted_id})
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # Fetch which strategies are configured as default
    config = await _get_or_seed_config(db)
    active_strategies = config["chunking"].get("active_strategies", ["recursive"])

    # Kick off the pipeline in the background (non-blocking)
    background_tasks.add_task(run_strategies, file_id, str(file_path), active_strategies)

    return {
        "id": file_id,
        "message": "File uploaded. Processing started in background.",
        "filename": file.filename,
        "status": "processing",
        "strategies": active_strategies,
    }


@router.get("/files")
async def list_files(username: str = Depends(verify_admin)):
    db = get_database()
    
    # Pre-fetch folders for mapping
    folders_cursor = db["folders"].find({}, {"name": 1})
    folder_map = {str(f["_id"]): f["name"] for f in await folders_cursor.to_list(1000)}

    cursor = db["admin_files"].find({}).sort("uploaded_at", -1)
    files = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "title" not in doc:
            doc["title"] = doc.get("filename", "unknown.pdf").rsplit(".", 1)[0].replace("_", " ").title()
        
        # Attach folder name
        f_id = doc.get("folder_id")
        doc["folder_name"] = folder_map.get(f_id) if f_id else None
        
        files.append(doc)
    return files


# ─── Topics (Folders) Aggregation ─────────────────────────────────────────────
@router.get("/topics")
async def list_topics(username: str = Depends(verify_admin)):
    """Aggregate files into Research Topics (Folders) for the admin dashboard."""
    db = get_database()
    
    # 1. Fetch all explicit folders
    folders = await db["folders"].find({}).to_list(1000)
    
    # Initialize the topic map with explicit folders
    topics_map = {}
    for f in folders:
        fid = str(f["_id"])
        topics_map[fid] = {
            "id": fid,
            "name": f.get("name", "Unnamed Topic"),
            "documents_count": 0,
            "chunks_count": 0,
            "active_strategies": set(),
            "status": "embedded" # default optimistic status
        }
    
    # Ensure 'uncategorized' exists for files without a topic
    topics_map["uncategorized"] = {
        "id": "uncategorized",
        "name": "Uncategorized",
        "documents_count": 0,
        "chunks_count": 0,
        "active_strategies": set(),
        "status": "embedded"
    }

    # 2. Iterate over all files and populate the map
    files = await db["admin_files"].find({}).to_list(None)
    
    status_rank = {"error": 5, "processing": 4, "uploaded": 3, "chunked": 2, "embedded": 1}

    for doc in files:
        fid = str(doc.get("folder_id")) if doc.get("folder_id") else "uncategorized"
        
        # In case a folder was deleted but files still reference it
        if fid not in topics_map:
            topics_map[fid] = {
                "id": fid,
                "name": f"Unknown Topic ({fid})",
                "documents_count": 0,
                "chunks_count": 0,
                "active_strategies": set(),
                "status": "embedded"
            }
            
        t = topics_map[fid]
        t["documents_count"] += 1
        t["chunks_count"] += doc.get("chunks_count", 0)
        
        # Aggregate strategies
        doc_stats = doc.get("strategy_stats", {})
        for strat in doc_stats.keys():
            t["active_strategies"].add(strat)
            
        # Determine worst-case status for the topic
        current_status = t["status"]
        doc_status = doc.get("status", "uploaded")
        if status_rank.get(doc_status, 0) > status_rank.get(current_status, 1):
            t["status"] = doc_status

    # 3. Clean up empty topics if necessary (optional: we can keep empty folders visible)
    topics = list(topics_map.values())
    
    # Only remove 'uncategorized' if it's strictly empty
    if topics_map["uncategorized"]["documents_count"] == 0:
        topics = [t for t in topics if t["id"] != "uncategorized"]

    # Convert sets to lists
    for t in topics:
        t["active_strategies"] = list(t["active_strategies"])

    # Sort alphabetically
    topics.sort(key=lambda x: x["name"].lower())
    
    return topics


@router.get("/topics/{topic_id}/files")
async def get_topic_files(topic_id: str, username: str = Depends(verify_admin)):
    """Get all documents belonging to a specific topic."""
    db = get_database()
    query = {}
    
    if topic_id == "uncategorized":
        query = {"folder_id": {"$in": [None, ""]}}
    else:
        # Some legacy docs might store ObjectId, others strings
        from bson import ObjectId
        query_conditions = [{"folder_id": topic_id}]
        try:
            query_conditions.append({"folder_id": ObjectId(topic_id)})
        except Exception:
            pass
        query = {"$or": query_conditions}
        
    cursor = db["admin_files"].find(query).sort("uploaded_at", -1)
    files = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["folder_id"] = str(doc.get("folder_id", ""))
        if "title" not in doc:
            doc["title"] = doc.get("filename", "unknown.pdf").rsplit(".", 1)[0].replace("_", " ").title()
        files.append(doc)
    return files


@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: str, username: str = Depends(verify_admin)):
    """Deletes an entire topic, including all its documents and chunks."""
    db = get_database()
    query = {}
    
    if topic_id == "uncategorized":
        query = {"folder_id": {"$in": [None, ""]}}
    else:
        from bson import ObjectId
        query_conditions = [{"folder_id": topic_id}]
        try:
            query_conditions.append({"folder_id": ObjectId(topic_id)})
        except Exception:
            pass
        query = {"$or": query_conditions}

    files = await db["admin_files"].find(query).to_list(None)
    
    deleted_files_count = 0
    deleted_chunks_count = 0
    
    for paper in files:
        obj_id = paper["_id"]
        
        # Delete physical file
        filepath = Path(paper.get("filepath", ""))
        if filepath.exists() and filepath.is_file():
            try:
                filepath.unlink()
            except Exception as e:
                print(f"Warning: could not delete physical file: {e}")
                
        # Delete related chunks
        res = await db["paper_chunks"].delete_many({"paper_id": obj_id})
        deleted_chunks_count += res.deleted_count
        
        # Delete document record
        await db["admin_files"].delete_one({"_id": obj_id})
        deleted_files_count += 1

    # Delete the folder itself if it's not uncategorized
    if topic_id != "uncategorized":
        from bson import ObjectId
        try:
            await db["folders"].delete_one({"_id": ObjectId(topic_id)})
        except Exception:
            pass

    return {
        "message": f"Topic deleted successfully. Removed {deleted_files_count} documents and {deleted_chunks_count} chunks.",
        "documents_deleted": deleted_files_count,
        "chunks_deleted": deleted_chunks_count
    }


# ─── Delete file (cascade) ─────────────────────────────────────────────────────
@router.delete("/files/{file_id}")
async def delete_file(file_id: str, username: str = Depends(verify_admin)):
    """
    Deletes the paper record, ALL its chunks (all strategies), and the physical PDF.
    """
    from bson import ObjectId
    db = get_database()

    try:
        obj_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID format")

    paper = await db["admin_files"].find_one({"_id": obj_id})
    if not paper:
        raise HTTPException(status_code=404, detail="File not found")

    # 1. Delete physical file
    filepath = Path(paper.get("filepath", ""))
    if filepath.exists() and filepath.is_file():
        try:
            filepath.unlink()
        except Exception as e:
            print(f"Warning: could not delete physical file: {e}")

    # 2. Cascade delete ALL chunks for this paper (all strategies)
    delete_result = await db["paper_chunks"].delete_many({"paper_id": obj_id})
    print(f"🗑️  Deleted {delete_result.deleted_count} chunks for paper {file_id}")

    # 3. Delete the paper record
    await db["admin_files"].delete_one({"_id": obj_id})

    return {
        "message": "Paper and all associated chunks deleted.",
        "id": file_id,
        "chunks_deleted": delete_result.deleted_count
    }


# ─── Get chunks (filterable by strategy) ──────────────────────────────────────
@router.get("/files/{file_id}/chunks")
async def get_paper_chunks(
    file_id: str,
    strategy: Optional[str] = None,
    username: str = Depends(verify_admin),
):
    """Return chunks for a paper, optionally filtered by strategy name."""
    from bson import ObjectId
    db = get_database()

    try:
        obj_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID format")

    query = {"paper_id": obj_id}
    if strategy:
        query["strategy"] = strategy

    cursor = db["paper_chunks"].find(query).sort([("strategy", 1), ("metadata.chunk_index", 1)])
    chunks = await cursor.to_list(length=None)

    for c in chunks:
        c["_id"] = str(c["_id"])
        c["paper_id"] = str(c["paper_id"])

    return chunks


# ─── Delete chunks ─────────────────────────────────────────────────────────────
@router.delete("/files/{file_id}/chunks")
async def delete_paper_chunks(
    file_id: str,
    strategy: Optional[str] = None,
    username: str = Depends(verify_admin),
):
    """
    Delete chunks for a paper. Pass ?strategy=recursive to clear only one strategy.
    Omit strategy to clear ALL chunks and reset status to 'uploaded'.
    """
    from bson import ObjectId
    db = get_database()

    try:
        obj_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID format")

    delete_filter = {"paper_id": obj_id}
    if strategy:
        delete_filter["strategy"] = strategy

    result = await db["paper_chunks"].delete_many(delete_filter)

    # Recalculate remaining chunks
    remaining = await db["paper_chunks"].count_documents({"paper_id": obj_id})

    new_status = "uploaded" if remaining == 0 else "embedded"
    update_fields = {"status": new_status, "chunks_count": remaining}
    if remaining == 0:
        update_fields["strategy_stats"] = {}
        update_fields["active_strategies"] = []

    await db["admin_files"].update_one({"_id": obj_id}, {"$set": update_fields})

    return {
        "message": f"Cleared {result.deleted_count} chunks" + (f" for strategy '{strategy}'" if strategy else " (all strategies)"),
        "chunks_deleted": result.deleted_count,
        "chunks_remaining": remaining,
    }


# ─── Trigger processing ────────────────────────────────────────────────────────
class ProcessRequest(BaseModel):
    strategies: Optional[List[str]] = None  # None = use config default


@router.post("/files/{file_id}/process")
async def process_file(
    file_id: str,
    background_tasks: BackgroundTasks,
    body: ProcessRequest = ProcessRequest(),
    username: str = Depends(verify_admin),
):
    """
    Manually trigger the chunking + embedding pipeline.
    Optionally specify which strategies to run via the request body.
    Runs as a background task so the HTTP response returns immediately.
    """
    from bson import ObjectId
    db = get_database()

    try:
        obj_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID format")

    paper = await db["admin_files"].find_one({"_id": obj_id})
    if not paper:
        raise HTTPException(status_code=404, detail="File not found")

    filepath = paper.get("filepath")
    if not filepath or not Path(filepath).exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "The PDF file was not found on the server. This usually happens when the "
                "Docker container was restarted without a persistent volume. "
                "Please delete this record and re-upload the file."
            )
        )

    # Determine strategies: request body → config default → fallback
    if body.strategies:
        strategies = [s for s in body.strategies if s in AVAILABLE_STRATEGIES]
        if not strategies:
            raise HTTPException(status_code=400, detail=f"No valid strategies. Choose from: {AVAILABLE_STRATEGIES}")
    else:
        config = await _get_or_seed_config(db)
        strategies = config["chunking"].get("active_strategies", ["recursive"])

    background_tasks.add_task(run_strategies, file_id, filepath, strategies)

    return {
        "message": "Processing started in background.",
        "strategies": strategies,
        "status": "processing",
    }


# ─── Config ────────────────────────────────────────────────────────────────────
@router.get("/config")
async def get_config(username: str = Depends(verify_admin)):
    """Returns the system config, auto-seeding defaults if not yet created."""
    db = get_database()
    config = await _get_or_seed_config(db)
    config.pop("_id", None)
    return config


@router.get("/config/llm-catalogue")
async def get_llm_catalogue(username: str = Depends(verify_admin)):
    """Return the full list of supported LLM providers and models."""
    return LLM_CATALOGUE


class FrontendSettings(BaseModel):
    visible_strategies: Optional[List[str]] = None
    visible_models: Optional[List[str]] = None

class ConfigUpdate(BaseModel):
    active_strategies: Optional[List[str]] = None
    embedding: Optional[str] = None
    evaluation: Optional[str] = None
    active_model: Optional[str] = None
    debug_mode: Optional[bool] = None
    chat_enabled: Optional[bool] = None
    frontend_settings: Optional[FrontendSettings] = None


@router.put("/config")
async def update_config(update_data: ConfigUpdate, username: str = Depends(verify_admin)):
    """Update active strategies and model choices in the global config."""
    db = get_database()

    set_fields = {}
    if update_data.active_strategies is not None:
        valid = [s for s in update_data.active_strategies if s in AVAILABLE_STRATEGIES]
        if not valid:
            raise HTTPException(status_code=400, detail=f"No valid strategies. Choose from: {AVAILABLE_STRATEGIES}")
        set_fields["chunking.active_strategies"] = valid
    if update_data.embedding is not None:
        set_fields["embedding.active"] = update_data.embedding
    if update_data.evaluation is not None:
        set_fields["evaluation.active"] = update_data.evaluation
    if update_data.active_model is not None:
        if update_data.active_model not in ALL_MODEL_IDS:
            raise HTTPException(status_code=400, detail=f"Unknown model '{update_data.active_model}'.")
        set_fields["llm.active_model"] = update_data.active_model
    if update_data.debug_mode is not None:
        set_fields["debug_mode"] = update_data.debug_mode
    if update_data.chat_enabled is not None:
        set_fields["chat_enabled"] = update_data.chat_enabled
    if update_data.frontend_settings is not None:
        if update_data.frontend_settings.visible_strategies is not None:
            set_fields["frontend_settings.visible_strategies"] = update_data.frontend_settings.visible_strategies
        if update_data.frontend_settings.visible_models is not None:
            set_fields["frontend_settings.visible_models"] = update_data.frontend_settings.visible_models

    if not set_fields:
        raise HTTPException(status_code=400, detail="No fields to update.")

    result = await db["system_config"].update_one({"_id": "global_config"}, {"$set": set_fields})
    if result.matched_count == 0:
        await db["system_config"].insert_one({**DEFAULT_CONFIG, **{"_id": "global_config"}})

    return {"message": "Configuration updated.", "updated_fields": list(set_fields.keys())}
