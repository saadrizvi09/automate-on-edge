"""PDF extraction agent for converting datasheet content into structured requirements."""

import json
from json import JSONDecodeError

import fitz
import requests

from backend.config import ask_nova

EXTRACTOR_PROMPT_TEMPLATE = """You are a product verification engineer. Extract all testable requirements from the following product specification text.

Return ONLY a JSON array. No explanation, no markdown, no code blocks. Raw JSON only.

Each item must have exactly these fields:
- id: string (format REQ-001, REQ-002, etc.)
- description: string (the requirement in plain English)
- acceptance_criteria: string (the specific measurable threshold)
- test_method: string (how to test it physically)

Specification text:
{spec_text}
"""


REQUIRED_KEYS = {"id", "description", "acceptance_criteria", "test_method"}


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract all text content from a PDF byte stream.

    Args:
        pdf_bytes: Raw bytes of the source PDF document.

    Returns:
        The concatenated text extracted from each page of the PDF.
    """
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return "\n".join(page.get_text("text").strip() for page in document).strip()
    finally:
        document.close()


def _parse_requirements(raw_response: str) -> list[dict]:
    """
    Parse and validate a Nova response into requirement dictionaries.

    Args:
        raw_response: Raw text returned by the model.

    Returns:
        A validated list of requirement dictionaries.

    Raises:
        ValueError: If the response is not a valid requirements array.
    """
    parsed = json.loads(raw_response)
    if not isinstance(parsed, list):
        raise ValueError("Nova response must be a JSON array")
    for item in parsed:
        if not isinstance(item, dict) or set(item.keys()) != REQUIRED_KEYS:
            raise ValueError("Each requirement must match the required schema exactly")
    return parsed


def extract_requirements(pdf_text: str) -> list[dict]:
    """
    Extract structured testable requirements from datasheet text using Nova.

    Args:
        pdf_text: Plain text extracted from the source PDF.

    Returns:
        A list of requirement dictionaries matching the architecture schema.

    Raises:
        RuntimeError: If the Bedrock request fails or the response cannot be parsed.
    """
    prompt = EXTRACTOR_PROMPT_TEMPLATE.format(spec_text=pdf_text)
    retry_prompt = (
        prompt
        + "\nYou previously returned invalid JSON. Return a valid JSON array only, with no surrounding text."
    )
    last_error: Exception | None = None

    for current_prompt in (prompt, retry_prompt):
        try:
            raw_response = ask_nova(current_prompt)
        except requests.Timeout as exc:
            raise RuntimeError("Requirement extraction timed out while calling Bedrock") from exc
        except requests.ConnectionError as exc:
            raise RuntimeError("Requirement extraction could not reach Bedrock") from exc
        except RuntimeError as exc:
            raise RuntimeError(f"Requirement extraction Bedrock error: {exc}") from exc

        try:
            return _parse_requirements(raw_response)
        except (JSONDecodeError, ValueError) as exc:
            last_error = exc

    raise RuntimeError("Requirement extraction returned invalid JSON twice") from last_error
