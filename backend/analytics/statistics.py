"""Statistical process control helpers for verification readings."""

from __future__ import annotations

from math import exp, pi, sqrt
from statistics import mean, stdev


def expected_state_from_inputs(input_a: int, input_b: int) -> str:
    """Return the expected logical output state for a NAND gate."""
    return "LOW" if input_a == 1 and input_b == 1 else "HIGH"


def spec_limit_for_state(expected_state: str) -> tuple[float | None, float | None, str]:
    """Return lower and upper spec limits plus a human-readable label."""
    if expected_state == "HIGH":
        return 2.4, None, "> 2.4V"
    return None, 0.4, "< 0.4V"


def describe_reading_group(reading: dict) -> str:
    """Build a stable group identifier for a reading condition."""
    return f"Gate {reading['gate']} A={reading['input_a']} B={reading['input_b']}"


def enrich_reading(reading: dict, source: str, phase: str = "initial", batch_id: str | None = None) -> dict:
    """Attach derived spec metadata to a reading dictionary."""
    expected_state = expected_state_from_inputs(reading["input_a"], reading["input_b"])
    lower_limit, upper_limit, spec_limit = spec_limit_for_state(expected_state)
    measured_voltage = float(reading["measured_voltage"])
    violation = 0.0
    if lower_limit is not None and measured_voltage < lower_limit:
        violation = lower_limit - measured_voltage
    if upper_limit is not None and measured_voltage > upper_limit:
        violation = measured_voltage - upper_limit

    enriched = dict(reading)
    enriched.update(
        {
            "expected_state": expected_state,
            "expected_voltage_min": lower_limit or 0.0,
            "expected_voltage_max": upper_limit,
            "spec_limit": spec_limit,
            "source": source,
            "phase": phase,
            "batch_id": batch_id,
            "is_anomaly": violation > 0,
            "violation_margin": round(violation, 4),
        }
    )
    return enriched


def _bell_curve_points(avg: float, sigma: float, lower_limit: float | None, upper_limit: float | None) -> list[dict]:
    """Build lightweight bell-curve points for dashboard rendering."""
    if sigma <= 0:
        span = 0.25
        xs = [avg - span + (index * (2 * span / 15)) for index in range(16)]
        return [{"x": round(x, 4), "y": 1.0 if abs(x - avg) < 0.02 else 0.2} for x in xs]

    low = avg - (4 * sigma)
    high = avg + (4 * sigma)
    if lower_limit is not None:
        low = min(low, lower_limit - sigma)
    if upper_limit is not None:
        high = max(high, upper_limit + sigma)

    points: list[dict] = []
    step = (high - low) / 23
    scale = sigma * sqrt(2 * pi)
    for index in range(24):
        x_value = low + (step * index)
        exponent = -(((x_value - avg) ** 2) / (2 * (sigma**2)))
        points.append({"x": round(x_value, 4), "y": round(exp(exponent) / scale, 6)})
    return points


def _cpk(avg: float, sigma: float, lower_limit: float | None, upper_limit: float | None) -> float | None:
    """Compute a one-sided or two-sided Cpk metric."""
    if sigma <= 0:
        if lower_limit is not None and avg < lower_limit:
            return 0.0
        if upper_limit is not None and avg > upper_limit:
            return 0.0
        return None

    candidates: list[float] = []
    if lower_limit is not None:
        candidates.append((avg - lower_limit) / (3 * sigma))
    if upper_limit is not None:
        candidates.append((upper_limit - avg) / (3 * sigma))
    return round(min(candidates), 3) if candidates else None


def compute_spc_summary(readings: list[dict]) -> dict:
    """Compute SPC metrics for each gate/input condition."""
    grouped: dict[tuple[int, int, int], list[dict]] = {}
    for reading in readings:
        key = (reading["gate"], reading["input_a"], reading["input_b"])
        grouped.setdefault(key, []).append(reading)

    groups: list[dict] = []
    alerts: list[str] = []
    worst_group: dict | None = None

    for key, group_readings in sorted(grouped.items()):
        first = group_readings[0]
        values = [float(item["measured_voltage"]) for item in group_readings]
        expected_state = first.get("expected_state") or expected_state_from_inputs(first["input_a"], first["input_b"])
        lower_limit, upper_limit, spec_limit = spec_limit_for_state(expected_state)
        avg = mean(values)
        sigma = stdev(values) if len(values) > 1 else 0.0
        cpk_value = _cpk(avg, sigma, lower_limit, upper_limit)
        capable = cpk_value is not None and cpk_value >= 1.33
        violations = sum(1 for item in group_readings if item.get("is_anomaly") or item["result"] == "FAIL")
        group_summary = {
            "group_id": describe_reading_group(first),
            "gate": key[0],
            "input_a": key[1],
            "input_b": key[2],
            "expected_state": expected_state,
            "samples": len(values),
            "mean_voltage": round(avg, 4),
            "std_dev": round(sigma, 4),
            "min_voltage": round(min(values), 4),
            "max_voltage": round(max(values), 4),
            "spec_limit": spec_limit,
            "cpk": cpk_value,
            "capable": capable,
            "violations": violations,
            "bell_curve": _bell_curve_points(avg, sigma, lower_limit, upper_limit),
        }
        if violations > 0:
            alerts.append(
                f"{group_summary['group_id']} recorded {violations} anomaly sample(s) against {spec_limit}."
            )
        elif cpk_value is not None and cpk_value < 1.33:
            alerts.append(
                f"{group_summary['group_id']} is statistically weak with Cpk {cpk_value}."
            )

        if worst_group is None:
            worst_group = group_summary
        else:
            worst_cpk = worst_group["cpk"] if worst_group["cpk"] is not None else 999.0
            current_cpk = cpk_value if cpk_value is not None else 999.0
            if violations > worst_group["violations"] or current_cpk < worst_cpk:
                worst_group = group_summary

        groups.append(group_summary)

    capable = all(group["capable"] or group["cpk"] is None for group in groups) and all(group["violations"] == 0 for group in groups)
    return {
        "capable": capable,
        "groups": groups,
        "worst_group": worst_group["group_id"] if worst_group else None,
        "alerts": alerts,
    }
