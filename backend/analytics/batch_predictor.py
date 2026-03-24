"""Cross-batch simulation and drift analysis helpers."""

from __future__ import annotations

from statistics import mean

from backend.simulator.mock_device import MockDevice


def _gate_failure_rates(readings: list[dict]) -> dict[str, float]:
    gate_totals = {gate: 0 for gate in range(4)}
    gate_failures = {gate: 0 for gate in range(4)}
    for reading in readings:
        gate = int(reading["gate"])
        gate_totals[gate] += 1
        if reading["result"] == "FAIL":
            gate_failures[gate] += 1
    return {
        f"gate_{gate}": round(gate_failures[gate] / gate_totals[gate], 3) if gate_totals[gate] else 0.0
        for gate in range(4)
    }


def run_cross_batch_analysis(test_plan: list[dict], batch_count: int = 5) -> dict:
    """Run multiple deterministic simulation batches and summarize drift trends."""
    batches: list[dict] = []
    previous_rate = 0.0
    drift_detected = False

    for batch_index in range(batch_count):
        seed = 7400 + batch_index
        device = MockDevice(seed=seed, batch_profile=batch_index, inject_reference_failures=batch_index == 0)
        readings = device.run_tests(test_plan, cycles=3, phase="batch")
        failure_count = sum(1 for reading in readings if reading["result"] == "FAIL")
        failure_rate = round(failure_count / len(readings), 3) if readings else 0.0
        gate_rates = _gate_failure_rates(readings)
        if batch_index >= 2 and failure_rate > previous_rate:
            drift_detected = True
        previous_rate = failure_rate
        batches.append(
            {
                "batch_id": f"BATCH-{batch_index + 1:02d}",
                "seed": seed,
                "failure_count": failure_count,
                "failure_rate": failure_rate,
                "gate_failure_rates": gate_rates,
                "mean_voltage": round(mean(float(reading["measured_voltage"]) for reading in readings), 4),
            }
        )

    hottest_batch = max(batches, key=lambda batch: batch["failure_rate"], default=None)
    hotspot_gate: int | None = None
    if batches:
        gate_scores = {
            gate: round(mean(batch["gate_failure_rates"][f"gate_{gate}"] for batch in batches), 3)
            for gate in range(4)
        }
        hotspot_gate = max(gate_scores, key=gate_scores.get)
    else:
        gate_scores = {}

    trend_summary = "No manufacturing drift trend was detected across the simulated batches."
    if hottest_batch is not None and hotspot_gate is not None:
        trend_summary = (
            f"{hottest_batch['batch_id']} showed the highest failure rate at {hottest_batch['failure_rate']:.1%}. "
            f"Gate {hotspot_gate} is the dominant hotspot across the batch set, indicating drift pressure on that path."
        )
        if drift_detected and len(batches) >= 3:
            baseline = batches[0]["failure_rate"]
            trend_summary = (
                f"Drift emerges by {batches[2]['batch_id']}: failure rate rises from {baseline:.1%} in {batches[0]['batch_id']} "
                f"to {batches[2]['failure_rate']:.1%}, with Gate {hotspot_gate} carrying the largest sustained risk."
            )

    recommendation = (
        "Review upstream process controls for the hotspot gate, add tighter outgoing screening, and schedule targeted follow-up verification "
        "before using later batches in customer builds."
        if drift_detected
        else "Current simulated batches are stable enough for continued monitoring, but keep batch-level SPC visible in the dashboard."
    )

    return {
        "batch_count": batch_count,
        "batches": batches,
        "drift_detected": drift_detected,
        "trend_summary": trend_summary,
        "predicted_hotspot_gate": hotspot_gate,
        "recommendation": recommendation,
        "gate_scores": gate_scores,
    }
