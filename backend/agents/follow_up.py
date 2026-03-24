"""Agentic follow-up planning for targeted verification reruns."""

from __future__ import annotations

from backend.analytics.statistics import describe_reading_group


def plan_follow_up_tests(readings: list[dict], spc_summary: dict) -> list[dict]:
    """Propose targeted follow-up tests for failing or weak conditions."""
    plans: list[dict] = []
    seen_conditions: set[tuple[int, int, int]] = set()

    for reading in readings:
        key = (reading["gate"], reading["input_a"], reading["input_b"])
        if key in seen_conditions:
            continue
        if reading["result"] != "FAIL" and not reading.get("is_anomaly"):
            continue
        seen_conditions.add(key)
        plans.append(
            {
                "plan_id": f"FU-{len(plans) + 1:03d}",
                "gate": reading["gate"],
                "input_a": reading["input_a"],
                "input_b": reading["input_b"],
                "expected_state": reading["expected_state"],
                "sample_count": 50,
                "priority": "HIGH",
                "target_metric": f"Characterize {reading['spec_limit']} margin collapse on {describe_reading_group(reading)}",
                "rationale": (
                    f"{reading['test_id']} violated {reading['spec_limit']} with {reading['measured_voltage']}V. "
                    "Run 50 more samples on this exact condition to separate random noise from a repeatable defect."
                ),
            }
        )

    for group in spc_summary.get("groups", []):
        if len(plans) >= 3:
            break
        if group["cpk"] is None or group["cpk"] >= 1.33:
            continue
        key = (group["gate"], group["input_a"], group["input_b"])
        if key in seen_conditions:
            continue
        seen_conditions.add(key)
        plans.append(
            {
                "plan_id": f"FU-{len(plans) + 1:03d}",
                "gate": group["gate"],
                "input_a": group["input_a"],
                "input_b": group["input_b"],
                "expected_state": group["expected_state"],
                "sample_count": 30,
                "priority": "MEDIUM",
                "target_metric": f"Raise Cpk above 1.33 for {group['group_id']}",
                "rationale": (
                    f"{group['group_id']} has Cpk {group['cpk']}. Additional samples will show whether the condition is drifting "
                    "or simply under-sampled."
                ),
            }
        )

    return plans


def summarize_follow_up_runs(runs: list[dict]) -> str:
    """Summarize executed follow-up runs for the report and dashboard."""
    if not runs:
        return "The agent did not schedule targeted follow-up tests because no failing or weak conditions were detected."
    executed = [run for run in runs if run.get("executed")]
    if not executed:
        return "Follow-up plans were generated, but none were executed."
    return (
        f"The agent executed {len(executed)} targeted follow-up run(s), collecting "
        f"{sum(len(run.get('readings', [])) for run in executed)} additional readings on the riskiest conditions."
    )
