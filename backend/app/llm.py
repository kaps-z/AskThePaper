"""
llm.py — LLM Abstraction Layer for AskThePaper
================================================
Provides a single `get_llm_response(prompt, config)` function that routes
to the correct provider based on the active model configuration.

Supported providers:
  • google   — Gemini (gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash)
  • openai   — GPT-4o, GPT-4o-mini, GPT-3.5-turbo
  • anthropic — Claude 3 Haiku / Sonnet / Opus
  • ollama   — Local models (llama3, mistral, phi3 …)

Each provider only activates if the matching SDK is installed and the
required environment variable (API key) is set. Ollama runs locally via
HTTP, so no key is needed.
"""

from __future__ import annotations
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Model catalogue ───────────────────────────────────────────────────────────
# Provider → list of (model_id, display_name) tuples shown in Settings.
LLM_CATALOGUE = {
    "google": [
        ("gemini-2.0-flash",          "Gemini 2.0 Flash"),
        ("gemini-1.5-flash",          "Gemini 1.5 Flash"),
        ("gemini-1.5-pro",            "Gemini 1.5 Pro"),
    ],
    "openai": [
        ("gpt-4o",                    "GPT-4o"),
        ("gpt-4o-mini",               "GPT-4o Mini"),
        ("gpt-3.5-turbo",             "GPT-3.5 Turbo"),
    ],
    "anthropic": [
        ("claude-3-haiku-20240307",   "Claude 3 Haiku"),
        ("claude-3-sonnet-20240229",  "Claude 3 Sonnet"),
        ("claude-3-opus-20240229",    "Claude 3 Opus"),
        ("claude-3-5-sonnet-20241022","Claude 3.5 Sonnet"),
    ],
    "groq": [
        ("llama-3.1-70b-versatile",   "Llama 3.1 70B"),
        ("llama-3.1-8b-instant",      "Llama 3.1 8B (Fast)"),
        ("mixtral-8x7b-32768",        "Mixtral 8x7B"),
        ("gemma2-9b-it",              "Gemma 2 9B"),
    ],
}

# Flat list of all model ids (for validation)
ALL_MODEL_IDS = [mid for models in LLM_CATALOGUE.values() for mid, _ in models]

# Default model if config is missing
DEFAULT_MODEL = "gemini-1.5-flash"
DEFAULT_PROVIDER = "google"


# ─── Provider resolver ─────────────────────────────────────────────────────────
def provider_for_model(model_id: str) -> str:
    """Return which provider a model_id belongs to."""
    for provider, models in LLM_CATALOGUE.items():
        if any(m == model_id for m, _ in models):
            return provider
    return "google"


# ─── Main call interface ───────────────────────────────────────────────────────
async def get_llm_response(
    system_prompt: str,
    user_message: str,
    model_id: Optional[str] = None,
    temperature: float = 0.2,
) -> str:
    """
    Route the prompt to the correct LLM provider and return the response.

    Args:
        system_prompt: Instructions for the model (the RAG context prompt).
        user_message: The end-user question.
        model_id: Model to use. Falls back to DEFAULT_MODEL if None.
        temperature: Sampling temperature (lower = more factual).

    Returns:
        The model's response as a plain string.
    """
    model_id = model_id or DEFAULT_MODEL
    provider = provider_for_model(model_id)
    logger.info(f"🤖 LLM call → provider={provider} model={model_id}")

    if provider == "google":
        return await _call_google(model_id, system_prompt, user_message, temperature)
    elif provider == "openai":
        return await _call_openai(model_id, system_prompt, user_message, temperature)
    elif provider == "anthropic":
        return await _call_anthropic(model_id, system_prompt, user_message, temperature)
    elif provider == "groq":
        return await _call_groq(model_id, system_prompt, user_message, temperature)
    else:
        raise ValueError(f"Unknown provider '{provider}' for model '{model_id}'.")


# ─── Google Gemini ─────────────────────────────────────────────────────────────
async def _call_google(model_id: str, system_prompt: str, user_message: str, temperature: float) -> str:
    API_KEY = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not API_KEY:
        raise EnvironmentError("GOOGLE_API_KEY / GEMINI_API_KEY is not set.")

    try:
        import google.generativeai as genai
    except ImportError:
        raise ImportError("Install the SDK: pip install google-generativeai")

    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel(
        model_name=model_id,
        system_instruction=system_prompt,
        generation_config=genai.GenerationConfig(temperature=temperature)
    )
    # Use asyncio run_in_executor since the SDK is synchronous
    import asyncio
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: model.generate_content(user_message)
    )
    return response.text


# ─── OpenAI ───────────────────────────────────────────────────────────────────
async def _call_openai(model_id: str, system_prompt: str, user_message: str, temperature: float) -> str:
    API_KEY = os.environ.get("OPENAI_API_KEY")
    if not API_KEY:
        raise EnvironmentError("OPENAI_API_KEY is not set.")

    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise ImportError("Install the SDK: pip install openai")

    client = AsyncOpenAI(api_key=API_KEY)
    resp = await client.chat.completions.create(
        model=model_id,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ]
    )
    return resp.choices[0].message.content


# ─── Anthropic Claude ─────────────────────────────────────────────────────────
async def _call_anthropic(model_id: str, system_prompt: str, user_message: str, temperature: float) -> str:
    API_KEY = os.environ.get("ANTHROPIC_API_KEY")
    if not API_KEY:
        raise EnvironmentError("ANTHROPIC_API_KEY is not set.")

    try:
        import anthropic
    except ImportError:
        raise ImportError("Install the SDK: pip install anthropic")

    client = anthropic.AsyncAnthropic(api_key=API_KEY)
    response = await client.messages.create(
        model=model_id,
        max_tokens=2048,
        temperature=temperature,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text


# ─── Groq ───────────────────────────────────────────────────────────
async def _call_groq(model_id: str, system_prompt: str, user_message: str, temperature: float) -> str:
    """
    Calls Groq's ultra-fast inference API.
    Uses the OpenAI-compatible client. Free tier available at console.groq.com.
    """
    API_KEY = os.environ.get("GROQ_API_KEY")
    if not API_KEY:
        raise EnvironmentError("GROQ_API_KEY is not set.")

    try:
        from groq import AsyncGroq
    except ImportError:
        # Fallback: Groq is OpenAI-compatible, use openai SDK with base_url
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=API_KEY, base_url="https://api.groq.com/openai/v1")
            resp = await client.chat.completions.create(
                model=model_id, temperature=temperature,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_message},
                ]
            )
            return resp.choices[0].message.content
        except ImportError:
            raise ImportError("Install the SDK: pip install groq   (or pip install openai)")

    client = AsyncGroq(api_key=API_KEY)
    resp = await client.chat.completions.create(
        model=model_id, temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ]
    )
    return resp.choices[0].message.content

