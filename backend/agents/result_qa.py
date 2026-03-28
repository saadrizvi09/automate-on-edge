"""Natural-language Q&A over verification results."""

from __future__ import annotations

import json

import requests

from backend.config import ask_nova


QA_PROMPT_TEMPLATE = """You are answering engineering questions about a verification run.
Use only the supplied evidence. If the evidence is insufficient, say so explicitly.

Question:
{question}

Analysis:
{analysis_json}

Coverage summary:
{coverage_json}

Decision state:
{decision_json}

Batch analysis:
{batch_json}

Requirements:
{requirements_json}

Test plan:
{test_plan_json}

Return ONLY a JSON object with exactly these fields:
- answer: string
- citations: array of objects with fields kind, reference, excerpt
"""


def _fallback_answer(
    question: str,
    analysis: dict,
    requirements: list[dict],
    batch_analysis: dict | None,
    coverage_summary: dict | None = None,
    decision_state: dict | None = None,
) -> dict:
    lowered = question.lower()
    failures = analysis.get("failures", [])
    spc_groups = analysis.get("spc_summary", {}).get("groups", [])
    worst_group = min(
        [group for group in spc_groups if group.get("cpk") is not None],
        key=lambda group: group["cpk"],
        default=None,
    )
    hotspot_gate = batch_analysis.get("predicted_hotspot_gate") if batch_analysis else None
    coverage_gaps = (coverage_summary or {}).get("gaps", [])

    if ("why" in lowered and "reject" in lowered) or "why did you reject" in lowered:
        first_failure = failures[0] if failures else None
        gap_excerpt = coverage_gaps[0] if coverage_gaps else "No untested requirement gap was supplied with the current run context."
        if first_failure:
            answer = (
                f"The current run is rejected because {first_failure.get('test_id', 'the leading failure')} violated the measured electrical limit. "
                f"{first_failure.get('description', 'A failure was detected.')}."
            )
            if gap_excerpt:
                answer += f" Coverage context: {gap_excerpt}"
            if decision_state and decision_state.get("next_action"):
                answer += f" Recommended next action: {decision_state['next_action']}"
            return {
                "answer": answer,
                "citations": [
                    {
                        "kind": "failure",
                        "reference": first_failure.get("test_id", "failure"),
                        "excerpt": first_failure.get("description", ""),
                    },
                    {
                        "kind": "coverage",
                        "reference": "coverage-gap",
                        "excerpt": gap_excerpt,
                    },
                ],
            }

    if "coverage" in lowered or "gap" in lowered:
        if coverage_gaps:
            return {
                "answer": (
                    "Coverage is incomplete. The biggest remaining gaps are: "
                    + "; ".join(coverage_gaps[:3])
                ),
                "citations": [
                    {"kind": "coverage", "reference": f"gap-{index + 1}", "excerpt": gap}
                    for index, gap in enumerate(coverage_gaps[:3])
                ],
            }
        return {
            "answer": "Coverage appears complete for the current structured requirement set, but no explicit gap list was supplied.",
            "citations": [],
        }

    if "thermal" in lowered or "fail first" in lowered:
        if hotspot_gate is not None:
            return {
                "answer": (
                    f"Gate {hotspot_gate} is the most likely early-life risk under added thermal stress because it is also the cross-batch hotspot. "
                    "This is an inference from electrical drift data only; it is not a substitute for a real temperature sweep."
                ),
                "citations": [
                    {
                        "kind": "batch",
                        "reference": f"Gate {hotspot_gate}",
                        "excerpt": batch_analysis.get("trend_summary", ""),
                    }
                ],
            }
        if worst_group is not None:
            return {
                "answer": (
                    f"{worst_group['group_id']} is the weakest measured condition because it has the lowest Cpk in the current run. "
                    "Thermal-stress risk is inferred from statistical margin, not directly measured temperature data."
                ),
                "citations": [
                    {
                        "kind": "spc",
                        "reference": worst_group["group_id"],
                        "excerpt": f"Cpk {worst_group['cpk']} with mean {worst_group['mean_voltage']}V.",
                    }
                ],
            }

    if "automotive" in lowered:
        return {
            "answer": (
                "No. The current evidence is not enough to claim automotive suitability. The run covers bench-level electrical behavior only and does not "
                "include AEC-style temperature, vibration, lifetime, or qualification evidence."
            ),
            "citations": [
                {
                    "kind": "scope",
                    "reference": "verification scope",
                    "excerpt": f"The run executed {analysis.get('total_tests', 0)} electrical tests with {analysis.get('failed', 0)} failures.",
                }
            ],
        }

    if "which gate" in lowered and failures:
        gate_counts: dict[int, int] = {}
        for failure in failures:
            description = failure.get("description", "")
            for gate in range(4):
                if f"Gate {gate}" in description:
                    gate_counts[gate] = gate_counts.get(gate, 0) + 1
        if gate_counts:
            gate = max(gate_counts, key=gate_counts.get)
            return {
                "answer": f"Gate {gate} is currently the highest-risk gate because it appears most often in the detected failure set.",
                "citations": failures[:2],
            }

    requirement = requirements[0] if requirements else {"id": "REQ-000", "description": "No requirement context available."}
    return {
        "answer": (
            "The current data shows the measured electrical behavior and the follow-up analysis, but the answer requires a more specific question or broader evidence."
        ),
        "citations": [
            {
                "kind": "requirement",
                "reference": requirement.get("id", "REQ-000"),
                "excerpt": requirement.get("description", ""),
            }
        ],
    }


def answer_results_question(
    question: str,
    analysis: dict,
    readings: list[dict],
    requirements: list[dict],
    test_plan: list[dict],
    batch_analysis: dict | None = None,
    coverage_summary: dict | None = None,
    decision_state: dict | None = None,
) -> dict:
    """Answer a natural-language question using verification evidence."""
    prompt = QA_PROMPT_TEMPLATE.format(
        question=question,
        analysis_json=json.dumps({**analysis, "readings_considered": len(readings)}, indent=2),
        coverage_json=json.dumps(coverage_summary or {}, indent=2),
        decision_json=json.dumps(decision_state or {}, indent=2),
        batch_json=json.dumps(batch_analysis or {}, indent=2),
        requirements_json=json.dumps(requirements[:6], indent=2),
        test_plan_json=json.dumps(test_plan[:6], indent=2),
    )
    try:
        raw_response = ask_nova(prompt, max_tokens=1200)
        parsed = json.loads(raw_response)
        if isinstance(parsed, dict) and isinstance(parsed.get("answer"), str) and isinstance(parsed.get("citations"), list):
            return parsed
    except (ValueError, json.JSONDecodeError, requests.RequestException, RuntimeError):
        pass

    return _fallback_answer(question, analysis, requirements, batch_analysis, coverage_summary, decision_state)
