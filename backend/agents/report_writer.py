"""Report writer agent for producing professional DVP narrative text."""

import json
from json import JSONDecodeError

import requests

from backend.config import ask_nova

REPORT_WRITER_PROMPT_TEMPLATE = """You are a product verification engineer. Write a professional design verification report narrative for a 7400 NAND gate verification run.

Return ONLY a JSON object. No explanation, no markdown, no code blocks. Raw JSON only.

The JSON must have exactly these fields:
- narrative: string

Analysis:
{analysis_json}

Requirements:
{requirements_json}

Test plan:
{test_plan_json}
"""


def _parse_narrative_response(raw_response: str) -> str:
    """
    Parse a Nova response and extract the narrative field.

    Args:
        raw_response: Raw text returned by the model.

    Returns:
        The narrative text string.

    Raises:
        ValueError: If the response does not contain the expected narrative schema.
    """
    parsed = json.loads(raw_response)
    if not isinstance(parsed, dict) or set(parsed.keys()) != {"narrative"}:
        raise ValueError("Nova response must be a JSON object with a narrative field only")
    if not isinstance(parsed["narrative"], str):
        raise ValueError("Narrative field must be a string")
    return parsed["narrative"]


def write_report_narrative(analysis: dict, requirements: list, test_plan: list) -> str:
    """
    Generate professional DVP narrative text from analysis and execution context.

    Args:
        analysis: Analysis dictionary produced by the analyser agent.
        requirements: Requirement dictionaries extracted from the PDF.
        test_plan: Test-plan dictionaries used for execution.

    Returns:
        Professional narrative text for inclusion in the report.

    Raises:
        RuntimeError: If the Bedrock request fails or the response cannot be parsed.
    """
    prompt = REPORT_WRITER_PROMPT_TEMPLATE.format(
        analysis_json=json.dumps(analysis, indent=2),
        requirements_json=json.dumps(requirements, indent=2),
        test_plan_json=json.dumps(test_plan, indent=2),
    )
    retry_prompt = prompt + "\nYou previously returned invalid JSON. Return a valid JSON object with only the narrative field."
    last_error: Exception | None = None

    for current_prompt in (prompt, retry_prompt):
        try:
            raw_response = ask_nova(current_prompt)
        except requests.Timeout as exc:
            raise RuntimeError("Report narrative generation timed out while calling Bedrock") from exc
        except requests.ConnectionError as exc:
            raise RuntimeError("Report narrative generation could not reach Bedrock") from exc
        except RuntimeError as exc:
            raise RuntimeError(f"Report narrative generation Bedrock error: {exc}") from exc

        try:
            return _parse_narrative_response(raw_response)
        except (JSONDecodeError, ValueError) as exc:
            last_error = exc

    raise RuntimeError("Report narrative generation returned invalid JSON twice") from last_error
