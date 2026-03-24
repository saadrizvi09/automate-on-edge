"""Analysis agent for turning raw readings into professional verification findings."""

from __future__ import annotations

import json
from json import JSONDecodeError

import requests

from backend.analytics.statistics import compute_spc_summary
from backend.config import ask_nova
from backend.agents.follow_up import plan_follow_up_tests


ANALYSER_PROMPT_TEMPLATE = """You are a product verification engineer analysing test results for a 7400 NAND gate IC.

Analyse the following test readings and identify the most important technical findings.

Return ONLY a JSON object. No explanation, no markdown, no code blocks. Raw JSON only.

The JSON must have these fields when possible:
- summary: string (2-3 sentence professional summary)
- failures: array of objects, each with: test_id, description, measured, spec, severity (HIGH/MEDIUM/LOW), root_cause, recommendation

Test readings:
{readings_json}

Test plan (for context):
{test_plan_json}
"""


def _parse_analysis(raw_response: str) -> dict:
    """Parse and lightly validate a Nova analysis response."""
    parsed = json.loads(raw_response)
    if not isinstance(parsed, dict):
        raise ValueError("Nova response must be a JSON object")
    if "summary" not in parsed or not isinstance(parsed["summary"], str):
        raise ValueError("Nova response must include a summary string")
    return parsed


def _expected_spec(reading: dict) -> tuple[str, str]:
    """Determine the expected voltage spec and description for a reading."""
    if reading["expected_state"] == "HIGH":
        return (f"Gate {reading['gate']} output HIGH voltage out of spec", "> 2.4V")
    return (f"Gate {reading['gate']} output LOW voltage out of spec", "< 0.4V")


def _build_failure_entry(reading: dict) -> dict:
    """Build a deterministic failure entry from a failing reading."""
    description, spec = _expected_spec(reading)
    return {
        "test_id": reading["test_id"],
        "description": description,
        "measured": f"{reading['measured_voltage']}V",
        "spec": spec,
        "severity": "HIGH" if reading.get("violation_margin", 0) >= 0.1 else "MEDIUM",
        "root_cause": "Possible internal gate degradation or incorrect loading on the output node",
        "recommendation": "Inspect the DUT, replace the IC if necessary, and repeat the verification run.",
    }


def _build_summary(total_tests: int, passed: int, failed: int, spc_summary: dict) -> str:
    """Build a deterministic professional summary string."""
    if failed == 0 and spc_summary.get("capable"):
        return (
            f"All {total_tests} executed tests passed and the observed process remained statistically capable. "
            "No electrical anomalies were detected in the evaluated NAND gate combinations."
        )
    if failed == 0:
        return (
            f"All {total_tests} executed tests passed, but the process is not fully capable across every condition. "
            "Additional sampling is recommended before sign-off."
        )
    return (
        f"{passed} of {total_tests} executed tests passed and {failed} failed against the current specification. "
        "The failures indicate electrical behaviour outside the NAND gate acceptance thresholds and triggered an autonomous follow-up plan."
    )


def _build_anomaly_highlights(failures: list[dict], spc_summary: dict) -> list[dict]:
    """Build compact anomaly cards for the dashboard alert surface."""
    highlights = [
        {
            "test_id": failure["test_id"],
            "message": f"{failure['description']} measured {failure['measured']} against {failure['spec']}",
            "severity": failure["severity"],
        }
        for failure in failures[:4]
    ]
    for alert in spc_summary.get("alerts", []):
        if len(highlights) >= 6:
            break
        highlights.append({"test_id": "SPC", "message": alert, "severity": "MEDIUM"})
    return highlights


def _reconcile_analysis(readings: list[dict], parsed_analysis: dict | None) -> dict:
    """Reconcile an LLM summary with deterministic counts, SPC, and follow-up planning."""
    failures = [_build_failure_entry(reading) for reading in readings if reading["result"] == "FAIL"]
    total_tests = len(readings)
    failed = len(failures)
    passed = total_tests - failed
    spc_summary = compute_spc_summary(readings)
    follow_up_plan = plan_follow_up_tests(readings, spc_summary)
    summary = parsed_analysis["summary"] if parsed_analysis else _build_summary(total_tests, passed, failed, spc_summary)

    return {
        "overall_result": "FAIL" if failed else "PASS",
        "total_tests": total_tests,
        "passed": passed,
        "failed": failed,
        "failures": failures,
        "summary": summary,
        "spc_summary": spc_summary,
        "follow_up_plan": follow_up_plan,
        "anomaly_highlights": _build_anomaly_highlights(failures, spc_summary),
    }


def analyse_results(readings: list[dict], test_plan: list[dict]) -> dict:
    """Analyse verification readings and return a structured failure assessment."""
    if not readings:
        empty_spc = compute_spc_summary([])
        return {
            "overall_result": "PASS",
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "failures": [],
            "summary": "No readings were available for analysis.",
            "spc_summary": empty_spc,
            "follow_up_plan": [],
            "anomaly_highlights": [],
        }

    prompt = ANALYSER_PROMPT_TEMPLATE.format(
        readings_json=json.dumps(readings, indent=2),
        test_plan_json=json.dumps(test_plan, indent=2),
    )
    retry_prompt = prompt + "\nYou previously returned invalid JSON. Return a valid JSON object only, with no surrounding text."
    parsed_analysis: dict | None = None

    for current_prompt in (prompt, retry_prompt):
        try:
            raw_response = ask_nova(current_prompt)
        except (ValueError, requests.Timeout, requests.ConnectionError, RuntimeError):
            break

        try:
            parsed_analysis = _parse_analysis(raw_response)
            break
        except (JSONDecodeError, ValueError):
            continue

    return _reconcile_analysis(readings, parsed_analysis)
