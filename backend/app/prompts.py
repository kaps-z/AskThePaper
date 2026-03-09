"""
prompts.py — Default LLM Prompt Templates for AskThePaper
==========================================================
All system prompts and prompt-building helpers live here.
Edit this file to change how the LLM behaves, what persona it adopts,
how it cites sources, or how conservative / creative it is.

Exported helpers
----------------
  build_rag_system_prompt(chunks)  →  str
      Builds the full system prompt injected on every /chat/ask call.
      Combines SYSTEM_PERSONA with the retrieved context block.

  SYSTEM_PERSONA
      The static "personality + rules" portion of the system prompt.
      Tweak this to change tone, citation style, or safety guardrails.
"""

from __future__ import annotations


# ─── Static persona / behaviour rules ────────────────────────────────────────
# This text is prepended to every RAG call. Change it freely.
SYSTEM_PERSONA: str = """You are AskThePaper, an expert research assistant specialized in \
scientific and academic literature.

Your behaviour rules:
1. Answer ONLY using the retrieved source excerpts provided below — do NOT use outside knowledge.
2. Always cite the source by its number, e.g. "[Source 1]".
3. If the context is insufficient to answer, say so honestly rather than guessing.
4. Be concise yet precise. Prefer bullet points for multi-part answers.
5. Never reveal or repeat the raw context verbatim; paraphrase when appropriate.
6. Maintain a professional, neutral academic tone."""


# ─── RAG context wrapper ──────────────────────────────────────────────────────
_CONTEXT_BLOCK_TEMPLATE: str = """

=== RETRIEVED CONTEXT ===
{context}
========================"""


# ─── Public helper ────────────────────────────────────────────────────────────
def build_rag_system_prompt(chunks: list[dict]) -> str:
    """
    Build the full system prompt for a RAG query.

    Parameters
    ----------
    chunks : list[dict]
        Each chunk must have keys: content, strategy, metadata (with 'page'), score.

    Returns
    -------
    str
        The complete system prompt to pass to the LLM.
    """
    context = "\n\n---\n\n".join(
        f"[Source {i+1} | {c['strategy']} | Page {c['metadata'].get('page', '?')} | Score {c['score']:.3f}]\n{c['content']}"
        for i, c in enumerate(chunks)
    )
    return SYSTEM_PERSONA + _CONTEXT_BLOCK_TEMPLATE.format(context=context)
