"""Test planner agent for converting requirements into structured verification cases."""

import json
import re
from json import JSONDecodeError

import requests

from backend.config import ask_nova

TEST_PLANNER_PROMPT_TEMPLATE = """You are a product verification engineer. Generate a test plan from these requirements.

Return ONLY a JSON array. No explanation, no markdown, no code blocks. Raw JSON only.

Each item must have exactly these fields:
- test_id: string (format TC-001, TC-002, etc.)
- requirement_id: string (matching REQ-xxx from input)
- test_name: string
- steps: array of strings
- expected_result: string
- pass_criteria: string (Python-evaluatable condition e.g. \"voltage > 2.4\")

Requirements:
{requirements_json}
"""

REQUIRED_KEYS = {
    "test_id",
    "requirement_id",
    "test_name",
    "steps",
    "expected_result",
    "pass_criteria",
}
RESPONSE_WRAPPER_KEYS = ("test_plan", "tests", "items")


def _json_candidates(raw_response: str) -> list[str]:
    """Return likely JSON substrings from a model response."""
    cleaned = raw_response.strip()
    if not cleaned:
        return []

    candidates: list[str] = [cleaned]
    lines = cleaned.splitlines()
    if lines and lines[0].startswith("```") and lines[-1].strip() == "```":
        inner = "\n".join(lines[1:-1]).strip()
        if inner:
            candidates.append(inner)

    first_array = cleaned.find("[")
    last_array = cleaned.rfind("]")
    if first_array != -1 and last_array > first_array:
        candidates.append(cleaned[first_array : last_array + 1])

    first_object = cleaned.find("{")
    last_object = cleaned.rfind("}")
    if first_object != -1 and last_object > first_object:
        candidates.append(cleaned[first_object : last_object + 1])

    deduped: list[str] = []
    for candidate in candidates:
        if candidate not in deduped:
            deduped.append(candidate)
    return deduped


def _normalize_test_plan_item(item: dict, index: int) -> dict:
    """Normalize and validate a single plan item."""
    if not isinstance(item, dict):
        raise ValueError("Each test plan item must be an object")

    missing_keys = REQUIRED_KEYS.difference(item.keys())
    if missing_keys:
        raise ValueError(f"Missing keys in test plan item {index + 1}: {sorted(missing_keys)}")

    steps = item.get("steps")
    if not isinstance(steps, list) or not steps:
        raise ValueError("Each test plan item must contain a non-empty steps array")

    return {
        "test_id": str(item["test_id"]),
        "requirement_id": str(item["requirement_id"]),
        "test_name": str(item["test_name"]),
        "steps": [str(step) for step in steps],
        "expected_result": str(item["expected_result"]),
        "pass_criteria": str(item["pass_criteria"]),
    }


def _parse_test_plan(raw_response: str) -> list[dict]:
    """
    Parse and validate the test plan JSON returned by Nova.

    Args:
        raw_response: Raw text returned by the model.

    Returns:
        A validated list of test-plan dictionaries.

    Raises:
        ValueError: If the response does not match the expected test-plan schema.
    """
    last_error: Exception | None = None

    for candidate in _json_candidates(raw_response):
        try:
            parsed = json.loads(candidate)
        except JSONDecodeError as exc:
            last_error = exc
            continue

        if isinstance(parsed, dict):
            for key in RESPONSE_WRAPPER_KEYS:
                wrapped = parsed.get(key)
                if isinstance(wrapped, list):
                    parsed = wrapped
                    break

        if not isinstance(parsed, list):
            last_error = ValueError("Nova response must be a JSON array or object containing a test_plan array")
            continue

        return [_normalize_test_plan_item(item, index) for index, item in enumerate(parsed)]

    raise ValueError("Nova response could not be parsed into a valid test plan") from last_error


def _split_test_method(test_method: str) -> list[str]:
    """Split a requirement test method into readable execution steps."""
    segments = [segment.strip().rstrip(".") for segment in re.split(r"[\n;]+", test_method) if segment.strip()]
    if segments:
        return segments
    return []


def _derive_pass_criteria(requirement: dict) -> str:
    """Build a deterministic pass/fail expression from requirement text."""
    text = " ".join(
        [
            str(requirement.get("acceptance_criteria", "") or ""),
            str(requirement.get("description", "") or ""),
        ]
    ).strip()
    lowered = text.lower()
    numbers = re.findall(r"\d+(?:\.\d+)?", text)

    if "between" in lowered and len(numbers) >= 2:
        lower, upper = numbers[0], numbers[1]
        return f"{lower} <= measured_voltage <= {upper}"
    if any(token in lowered for token in (">=", "greater than or equal", "at least", "minimum")) and numbers:
        return f"measured_voltage >= {numbers[0]}"
    if any(token in lowered for token in ("<=", "less than or equal", "at most", "maximum")) and numbers:
        return f"measured_voltage <= {numbers[0]}"
    if any(token in lowered for token in (">", "greater than", "above")) and numbers:
        return f"measured_voltage > {numbers[0]}"
    if any(token in lowered for token in ("<", "less than", "below")) and numbers:
        return f"measured_voltage < {numbers[0]}"
    return "True"


def _fallback_test_plan(requirements: list[dict]) -> list[dict]:
    """Create a deterministic test plan when the model response is unusable."""
    fallback_plan: list[dict] = []

    for index, requirement in enumerate(requirements, start=1):
        requirement_id = str(requirement.get("id") or f"REQ-{index:03d}")
        description = str(requirement.get("description") or f"Requirement {index}").strip()
        test_method = str(requirement.get("test_method") or "").strip()
        acceptance_criteria = str(requirement.get("acceptance_criteria") or description).strip()
        steps = _split_test_method(test_method)
        if not steps:
            steps = [
                "Power the DUT at nominal supply voltage",
                f"Exercise the condition for {requirement_id}",
                "Measure and record the output voltage",
            ]
        elif len(steps) == 1:
            steps.append("Measure and record the output voltage")

        fallback_plan.append(
            {
                "test_id": f"TC-{index:03d}",
                "requirement_id": requirement_id,
                "test_name": clip_text(description, 72),
                "steps": steps,
                "expected_result": acceptance_criteria,
                "pass_criteria": _derive_pass_criteria(requirement),
            }
        )

    return fallback_plan


def clip_text(value: str, limit: int) -> str:
    """Trim long requirement descriptions for compact fallback test names."""
    if len(value) <= limit:
        return value
    return f"{value[: limit - 1].rstrip()}..."


def generate_test_plan(requirements: list[dict]) -> list[dict]:
    """
    Generate a structured verification test plan from extracted requirements.

    Args:
        requirements: Requirement dictionaries matching the architecture schema.

    Returns:
        A list of test-plan dictionaries.

    Raises:
        RuntimeError: If the Bedrock request fails or the response cannot be parsed.
    """
    if not requirements:
        return []

    requirements_json = json.dumps(requirements, indent=2)
    prompt = TEST_PLANNER_PROMPT_TEMPLATE.format(requirements_json=requirements_json)
    retry_prompt = (
        prompt
        + "\nYou previously returned invalid JSON. Return a valid JSON array only, with no surrounding text."
    )
    last_error: Exception | None = None

    for current_prompt in (prompt, retry_prompt):
        try:
            raw_response = ask_nova(current_prompt)
        except requests.Timeout as exc:
            raise RuntimeError("Test plan generation timed out while calling Bedrock") from exc
        except requests.ConnectionError as exc:
            raise RuntimeError("Test plan generation could not reach Bedrock") from exc
        except RuntimeError as exc:
            raise RuntimeError(f"Test plan generation Bedrock error: {exc}") from exc

        try:
            return _parse_test_plan(raw_response)
        except (JSONDecodeError, ValueError) as exc:
            last_error = exc

    return _fallback_test_plan(requirements)
