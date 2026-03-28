"""Configuration loading and model routing helpers for the AI PVE agent."""

from __future__ import annotations

import os
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions")
GROQ_MODEL = os.getenv("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
BEDROCK_API_KEY = os.getenv("BEDROCK_API_KEY")
BEDROCK_INVOKE_URL = os.getenv(
    "BEDROCK_INVOKE_URL",
    "https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-pro-v1:0/invoke",
)
BEDROCK_MODEL = os.getenv("BEDROCK_MODEL", "amazon.nova-pro-v1:0")
ARDUINO_PORT = os.getenv("ARDUINO_PORT", "COM3")
ARDUINO_BOARD = os.getenv("ARDUINO_BOARD", "arduino:avr:uno")
ARDUINO_CLI_PATH = os.getenv("ARDUINO_CLI_PATH", "arduino-cli")
DATABASE_URL = os.getenv("DATABASE_URL", "")

_MODEL_STATUS: dict[str, Any] = {
    "primary_provider": "Groq" if GROQ_API_KEY else "AWS Bedrock",
    "primary_model": GROQ_MODEL if GROQ_API_KEY else BEDROCK_MODEL,
    "fallback_provider": "AWS Bedrock" if GROQ_API_KEY and BEDROCK_API_KEY else None,
    "fallback_model": BEDROCK_MODEL if GROQ_API_KEY and BEDROCK_API_KEY else None,
    "active_provider": "Groq" if GROQ_API_KEY else ("AWS Bedrock" if BEDROCK_API_KEY else "Unconfigured"),
    "active_model": GROQ_MODEL if GROQ_API_KEY else (BEDROCK_MODEL if BEDROCK_API_KEY else "none"),
    "fallback_used": False,
    "last_error": None,
    "routing_mode": (
        "Groq primary with Bedrock fallback on Groq rate/spend limit"
        if GROQ_API_KEY and BEDROCK_API_KEY
        else ("Groq primary only" if GROQ_API_KEY else "Bedrock only")
    ),
}


def _record_model_usage(provider: str, model: str, fallback_used: bool, last_error: str | None = None) -> None:
    _MODEL_STATUS["primary_provider"] = "Groq" if GROQ_API_KEY else "AWS Bedrock"
    _MODEL_STATUS["primary_model"] = GROQ_MODEL if GROQ_API_KEY else BEDROCK_MODEL
    _MODEL_STATUS["fallback_provider"] = "AWS Bedrock" if GROQ_API_KEY and BEDROCK_API_KEY else None
    _MODEL_STATUS["fallback_model"] = BEDROCK_MODEL if GROQ_API_KEY and BEDROCK_API_KEY else None
    _MODEL_STATUS["active_provider"] = provider
    _MODEL_STATUS["active_model"] = model
    _MODEL_STATUS["fallback_used"] = fallback_used
    _MODEL_STATUS["last_error"] = last_error
    _MODEL_STATUS["routing_mode"] = (
        "Groq primary with Bedrock fallback on Groq rate/spend limit"
        if GROQ_API_KEY and BEDROCK_API_KEY
        else ("Groq primary only" if GROQ_API_KEY else "Bedrock only")
    )


def get_model_status() -> dict[str, Any]:
    """Return the currently configured routing stack and the last active model."""
    return dict(_MODEL_STATUS)


def _extract_groq_text(payload: dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError("Groq API returned no completion choices")
    message = choices[0].get("message") or {}
    content = message.get("content", "")
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "".join(parts)
    if isinstance(content, str):
        return content
    raise RuntimeError("Groq API returned an unsupported completion payload")


def _groq_limit_reached(response: requests.Response) -> bool:
    if response.status_code == 429:
        return True
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    error = payload.get("error", {}) if isinstance(payload, dict) else {}
    code = str(error.get("code", "")).lower()
    message = str(error.get("message", response.text)).lower()
    return response.status_code in {400, 403} and (
        code in {"blocked_api_access", "rate_limit_exceeded", "insufficient_quota"}
        or "rate limit" in message
        or "quota" in message
        or "spend" in message
        or "usage limit" in message
        or "blocked_api_access" in message
    )


def _ask_groq(prompt: str, max_tokens: int) -> str:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set in environment")

    try:
        response = requests.post(
            GROQ_API_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GROQ_API_KEY}",
            },
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": max_tokens,
            },
            timeout=30,
        )
    except requests.Timeout as exc:
        raise requests.Timeout("Groq API timed out after 30 seconds") from exc
    except requests.ConnectionError as exc:
        raise requests.ConnectionError("Cannot reach Groq API - check internet connection") from exc

    if response.status_code != 200:
        if _groq_limit_reached(response):
            raise RuntimeError(f"GROQ_LIMIT_REACHED: {response.status_code}: {response.text}")
        raise RuntimeError(f"Groq API error {response.status_code}: {response.text}")

    return _extract_groq_text(response.json())


def _ask_bedrock(prompt: str, max_tokens: int) -> str:
    if not BEDROCK_API_KEY:
        raise ValueError("BEDROCK_API_KEY not set in environment")

    try:
        response = requests.post(
            BEDROCK_INVOKE_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {BEDROCK_API_KEY}",
            },
            json={
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"maxTokens": max_tokens},
            },
            timeout=30,
        )
    except requests.Timeout as exc:
        raise requests.Timeout("Bedrock API timed out after 30 seconds") from exc
    except requests.ConnectionError as exc:
        raise requests.ConnectionError("Cannot reach Bedrock API - check internet connection") from exc

    if response.status_code != 200:
        raise RuntimeError(f"Bedrock API error {response.status_code}: {response.text}")

    return response.json()["output"]["message"]["content"][0]["text"]


def ask_nova(prompt: str, max_tokens: int = 2048) -> str:
    """
    Route model calls to Groq first, then fall back to AWS Bedrock only when Groq hits a usage limit.

    Args:
        prompt: The full prompt string to send.
        max_tokens: Maximum number of tokens to request in the response.

    Returns:
        The response text from the selected model.

    Raises:
        ValueError: If neither Groq nor Bedrock credentials are configured.
        requests.Timeout: If the active provider times out.
        requests.ConnectionError: If the active provider cannot be reached.
        RuntimeError: If the provider returns a non-limit error, or if fallback is unavailable.
    """
    if GROQ_API_KEY:
        try:
            response_text = _ask_groq(prompt, max_tokens)
            _record_model_usage("Groq", GROQ_MODEL, fallback_used=False)
            return response_text
        except RuntimeError as exc:
            if not str(exc).startswith("GROQ_LIMIT_REACHED:"):
                _record_model_usage("Groq", GROQ_MODEL, fallback_used=False, last_error=str(exc))
                raise RuntimeError(f"Groq primary model error: {exc}") from exc
            if not BEDROCK_API_KEY:
                _record_model_usage("Groq", GROQ_MODEL, fallback_used=False, last_error=str(exc))
                raise RuntimeError(
                    "Groq rate/spend limit reached and Bedrock fallback is not configured"
                ) from exc
            response_text = _ask_bedrock(prompt, max_tokens)
            _record_model_usage("AWS Bedrock", BEDROCK_MODEL, fallback_used=True, last_error=str(exc))
            return response_text

    if BEDROCK_API_KEY:
        response_text = _ask_bedrock(prompt, max_tokens)
        _record_model_usage("AWS Bedrock", BEDROCK_MODEL, fallback_used=False)
        return response_text

    raise ValueError("Neither GROQ_API_KEY nor BEDROCK_API_KEY is configured")
