"""Requirement conflict detection helpers."""

from __future__ import annotations

import re


CRITERIA_PATTERN = re.compile(r"(?P<operator>>=|<=|>|<|=)\s*(?P<value>\d+(?:\.\d+)?)")


def _normalize_subject(text: str) -> str:
    lowered = text.lower()
    if "output high" in lowered or "voh" in lowered:
        return "output_high_voltage"
    if "output low" in lowered or "vol" in lowered:
        return "output_low_voltage"
    if "input high" in lowered or "vih" in lowered:
        return "input_high_voltage"
    if "input low" in lowered or "vil" in lowered:
        return "input_low_voltage"
    return re.sub(r"\s+", "_", lowered.strip())[:80]


def _parse_bound(requirement: dict) -> tuple[str, str, float] | None:
    text = f"{requirement.get('description', '')} {requirement.get('acceptance_criteria', '')}"
    match = CRITERIA_PATTERN.search(text)
    if not match:
        return None
    return _normalize_subject(text), match.group("operator"), float(match.group("value"))


def detect_requirement_conflicts(requirements: list[dict]) -> list[dict]:
    """Detect simple threshold conflicts across extracted requirements."""
    parsed: list[tuple[dict, tuple[str, str, float]]] = []
    for requirement in requirements:
        bound = _parse_bound(requirement)
        if bound is not None:
            parsed.append((requirement, bound))

    conflicts: list[dict] = []
    for index, (left_requirement, left_bound) in enumerate(parsed):
        for right_requirement, right_bound in parsed[index + 1 :]:
            if left_bound[0] != right_bound[0]:
                continue

            left_operator = left_bound[1]
            right_operator = right_bound[1]
            left_value = left_bound[2]
            right_value = right_bound[2]
            conflict = False
            if left_operator.startswith(">") and right_operator.startswith("<") and left_value >= right_value:
                conflict = True
            if left_operator.startswith("<") and right_operator.startswith(">") and left_value <= right_value:
                conflict = True
            if left_operator == "=" and right_operator == "=" and left_value != right_value:
                conflict = True

            if conflict:
                conflicts.append(
                    {
                        "conflict_id": f"CONFLICT-{len(conflicts) + 1:03d}",
                        "requirement_ids": [left_requirement["id"], right_requirement["id"]],
                        "subject": left_bound[0],
                        "explanation": (
                            f"{left_requirement['id']} defines {left_bound[0]} as {left_operator} {left_value}V, "
                            f"while {right_requirement['id']} defines it as {right_operator} {right_value}V."
                        ),
                        "severity": "HIGH",
                    }
                )
    return conflicts
