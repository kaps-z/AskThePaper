"""
chat/router.py — End-user chat/RAG API
=======================================
Endpoints:
  POST /chat/ask              — main RAG query (returns answer + optional debug)
  GET  /chat/sessions         — list sessions for a browser client
  GET  /chat/sessions/{id}    — get full message history for a session
  DELETE /chat/sessions/{id}  — clear a session
  GET  /chat/witty            — return a random witty loading phrase
  GET  /chat/config           — public config (debug_mode, chat_enabled, models, strategies)
"""

from __future__ import annotations
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from bson import ObjectId

from app.core.database import get_database
from app.embedding import embed_text, EMBEDDING_MODELS, DEFAULT_MODEL_ID
from app.chunking import AVAILABLE_STRATEGIES
from app.llm import get_llm_response, LLM_CATALOGUE, DEFAULT_MODEL
from app.chat.witty import random_phrase
from app.prompts import build_rag_system_prompt
from app.evaluation import evaluate_rag_response

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Chat"])


# ─── Pydantic models ──────────────────────────────────────────────────────────
class AskRequest(BaseModel):
    question: str
    topic_id: str                      # Required: which topic to chat with (folder_id or 'uncategorized')
    session_id: Optional[str] = None     # None = new session
    strategy: Optional[str] = None       # override; None = use config default
    model_id: Optional[str] = None       # override; None = use config default
    top_k: int = 5


class AskResponse(BaseModel):
    answer: str
    session_id: str
    message_id: str
    debug: Optional[dict] = None         # only present if debug_mode is ON in config


# ─── Helpers ─────────────────────────────────────────────────────────────────
async def _get_config(db) -> dict:
    cfg = await db["system_config"].find_one({"_id": "global_config"}) or {}
    return cfg


def _serialize(doc: dict) -> dict:
    """Convert ObjectId → str for JSON."""
    if doc is None:
        return doc
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, list):
            out[k] = [str(i) if isinstance(i, ObjectId) else i for i in v]
        else:
            out[k] = v
    return out


async def _retrieve_chunks(db, question: str, strategy: Optional[str], top_k: int, embed_model: str, paper_ids: list) -> list:
    """Embed query and do cosine similarity search via MongoDB within specific papers."""
    import numpy as np

    query_vec = embed_text(question, embed_model)

    # Build filter
    match_filter: dict = {"paper_id": {"$in": paper_ids}}
    if strategy:
        match_filter["strategy"] = strategy

    # Fetch relevant chunks
    cursor = db["paper_chunks"].find(match_filter, {"content": 1, "embedding": 1, "metadata": 1, "strategy": 1, "paper_id": 1})
    chunks = await cursor.to_list(length=2000)

    if not chunks:
        return []

    # Score via cosine similarity (numpy)
    q = np.array(query_vec)
    scored = []
    for chunk in chunks:
        emb = chunk.get("embedding")
        if not emb:
            continue
        c = np.array(emb)
        norm = np.linalg.norm(q) * np.linalg.norm(c)
        score = float(np.dot(q, c) / norm) if norm > 0 else 0.0
        scored.append({
            "content": chunk["content"],
            "score": score,
            "strategy": chunk.get("strategy", "unknown"),
            "metadata": chunk.get("metadata", {}),
            "paper_id": str(chunk.get("paper_id", "")),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


# _build_system_prompt has been moved to app/prompts.py as build_rag_system_prompt


# ─── Routes ────────────────────────────────────────────────────────────────────
@router.get("/topics")
async def list_chat_topics():
    """List all topics (folders) that have at least one embedded document available for chat."""
    db = get_database()
    
    # Map folder IDs to names
    folders_cursor = db["folders"].find({}, {"name": 1})
    folder_map = {str(f["_id"]): f["name"] for f in await folders_cursor.to_list(1000)}

    cursor = db["admin_files"].find({"status": "embedded"}, {"folder_id": 1})
    topic_ids = set()
    async for doc in cursor:
        f_id = str(doc.get("folder_id")) if doc.get("folder_id") else "uncategorized"
        topic_ids.add(f_id)
        
    topics = []
    for f_id in topic_ids:
        if f_id == "uncategorized":
            topics.append({"_id": "uncategorized", "name": "Uncategorized"})
        else:
            name = folder_map.get(f_id, f"Unknown Topic ({f_id})")
            topics.append({"_id": f_id, "name": name})
            
    # Sort alphabetically
    topics.sort(key=lambda x: x["name"].lower())
    return topics


@router.get("/witty")
async def get_witty_phrase():
    """Random witty loading message for the frontend."""
    return {"phrase": random_phrase()}


@router.get("/config")
async def get_public_config():
    """Public config: debug mode status, available models and strategies."""
    db = get_database()
    cfg = await _get_config(db)
    f_settings = cfg.get("frontend_settings", {})
    v_strategies = f_settings.get("visible_strategies", AVAILABLE_STRATEGIES)
    v_models = f_settings.get("visible_models", [])

    # Filter available strategies
    avail_strat = [s for s in AVAILABLE_STRATEGIES if s in v_strategies]
    
    # Filter LLM catalogue
    all_llms = cfg.get("llm", {}).get("catalogue", {})
    filtered_llms = {}
    if not v_models:
        filtered_llms = all_llms
    else:
        for prov, models in all_llms.items():
            found = [m for m in models if m[0] in v_models]
            if found:
                filtered_llms[prov] = found

    return {
        "chat_enabled": cfg.get("chat_enabled", True),
        "debug_mode": cfg.get("debug_mode", False),
        "active_strategies": cfg.get("chunking", {}).get("active_strategies", ["recursive"]),
        "available_strategies": avail_strat,
        "llm_catalogue": filtered_llms,
        "active_model": cfg.get("llm", {}).get("active_model", "gemini-1.5-flash")
    }


@router.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    db = get_database()
    cfg = await _get_config(db)
    debug_mode = cfg.get("debug_mode", False)

    logger.info(f"📥 /chat/ask | question='{req.question[:80]}' topic={req.topic_id} session={req.session_id}")

    # Respect admin kill-switch
    if not cfg.get("chat_enabled", True):
        logger.warning("⛔ Chat is disabled by admin. Rejecting request.")
        raise HTTPException(status_code=503, detail="Chat is currently disabled by the administrator.")

    # ── Session handling ──────────────────────────────────────────────────────
    session_id = req.session_id or str(uuid.uuid4())
    session = await db["chat_sessions"].find_one({"session_id": session_id})
    if not session:
        session = {
            "session_id": session_id,
            "created_at": datetime.now(timezone.utc),
            "title": req.question[:60],
        }
        await db["chat_sessions"].insert_one(session)
        logger.info(f"🆕 New session created: {session_id}")
    else:
        logger.info(f"↩️  Resuming session: {session_id}")

    # ── Resolve model + strategy ───────────────────────────────────────────────
    embed_model = cfg.get("embedding", {}).get("active", DEFAULT_MODEL_ID)
    model_id    = req.model_id or cfg.get("llm", {}).get("active_model", DEFAULT_MODEL)
    strategy    = req.strategy
    eval_framework = cfg.get("evaluation", {}).get("active", "custom")

    logger.info(f"🔧 Config resolved | model={model_id} embed={embed_model} strategy={strategy or 'default'} eval={eval_framework}")

    # ── Locate papers in the requested topic ───────────────────────────────────
    topic_id = req.topic_id
    query = {"status": "embedded"}

    if topic_id == "uncategorized":
        query["folder_id"] = {"$in": [None, ""]}
    else:
        from bson import ObjectId
        query_conditions = [{"folder_id": topic_id}]
        try:
            query_conditions.append({"folder_id": ObjectId(topic_id)})
        except Exception:
            pass
        query["$or"] = query_conditions

    cursor = db["admin_files"].find(query, {"_id": 1})
    paper_ids = [doc["_id"] for doc in await cursor.to_list(None)]
    logger.info(f"📚 Papers found in topic '{topic_id}': {len(paper_ids)}")

    if not paper_ids:
        logger.warning(f"⚠️  No embedded papers found for topic='{topic_id}'")
        return AskResponse(
            answer="No embedded documents available in this topic. Please select another topic or check the admin dashboard.",
            session_id=str(session_id),
            message_id=str(uuid.uuid4())
        )

    # ── Check chunk availability ───────────────────────────────────────────────
    strategy_to_check = strategy or cfg.get("chunking", {}).get("active_strategies", ["recursive"])[0]
    chunk_count = await db["paper_chunks"].count_documents({
        "paper_id": {"$in": paper_ids},
        "strategy": strategy_to_check
    })
    logger.info(f"🧩 Chunks available | strategy={strategy_to_check} count={chunk_count}")

    if chunk_count == 0:
        logger.warning(f"⚠️  No chunks for strategy='{strategy_to_check}' across {len(paper_ids)} paper(s).")
        return AskResponse(
            answer="No chunks available. Please check with admin to chat on this doc.",
            session_id=str(session_id),
            message_id=str(uuid.uuid4())
        )

    # ── Retrieve top-K relevant chunks ─────────────────────────────────────────
    logger.info(f"🔍 Retrieving top-{req.top_k} chunks for the query...")
    chunks = await _retrieve_chunks(
        db=db,
        question=req.question,
        strategy=strategy_to_check,
        top_k=req.top_k,
        embed_model=embed_model,
        paper_ids=paper_ids
    )
    if chunks:
        top_score = chunks[0].get("score", 0)
        logger.info(f"✅ Retrieved {len(chunks)} chunks | top score={top_score:.4f}")
    else:
        logger.warning("⚠️  No chunks retrieved after similarity search.")

    # ── Build prompt & call LLM ────────────────────────────────────────────────
    if not chunks:
        answer = "I couldn't find any relevant information in the selected topic to answer your question."
    else:
        system_prompt = build_rag_system_prompt(chunks)
        logger.info(f"🤖 Calling LLM | model={model_id} prompt_len={len(system_prompt)} chars")
        try:
            answer = await get_llm_response(
                system_prompt=system_prompt,
                user_message=req.question,
                model_id=model_id,
            )
            logger.info(f"✅ LLM response received | answer_len={len(answer)} chars")
        except Exception as e:
            logger.error(f"❌ LLM call failed | model={model_id} error={e}", exc_info=True)
            answer = "Sorry, I encountered an error while communicating with the AI model. Please try again later."

    # ── Evaluation (only when debug_mode is ON) ────────────────────────────────
    debug_payload = None
    if debug_mode:
        logger.info(f"📊 Debug mode ON — running evaluation (framework={eval_framework})")
        try:
            eval_result = await evaluate_rag_response(
                question=req.question,
                answer=answer,
                chunks=chunks,
                framework=eval_framework,
            )
        except Exception as e:
            logger.error(f"❌ Evaluation failed: {e}", exc_info=True)
            eval_result = {"error": str(e)}

        debug_payload = {
            "model_id":        model_id,
            "embed_model":     embed_model,
            "strategy_filter": strategy or "all",
            "top_k":           req.top_k,
            "chunks":          chunks,
            "evaluation":      eval_result,
        }
        logger.info(f"📊 Evaluation complete: {eval_result}")

    # ── Persist to MongoDB ─────────────────────────────────────────────────────
    message_id = str(uuid.uuid4())
    await db["chat_messages"].insert_one({
        "message_id":  message_id,
        "session_id":  session_id,
        "question":    req.question,
        "answer":      answer,
        "model_id":    model_id,
        "strategy":    strategy or "all",
        "created_at":  datetime.now(timezone.utc),
        "debug":       debug_payload,
    })
    await db["chat_sessions"].update_one(
        {"session_id": session_id},
        {"$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    logger.info(f"💾 Message saved | message_id={message_id} session={session_id}")

    return AskResponse(answer=answer, session_id=session_id, message_id=message_id, debug=debug_payload)


@router.get("/sessions")
async def list_sessions(limit: int = 30):
    db = get_database()
    cursor = db["chat_sessions"].find({}, {"_id": 0}).sort("updated_at", -1).limit(limit)
    sessions = await cursor.to_list(length=limit)
    return sessions


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    db = get_database()
    msgs = await db["chat_messages"].find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=200)
    return msgs


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    db = get_database()
    await db["chat_messages"].delete_many({"session_id": session_id})
    await db["chat_sessions"].delete_one({"session_id": session_id})
    return {"deleted": session_id}
