"""Tests for statistical process control helpers."""

from backend.analytics.statistics import compute_spc_summary
from backend.simulator.mock_device import MockDevice


def test_compute_spc_summary_reports_group_metrics() -> None:
    """Verify SPC output includes per-condition metrics and bell-curve points."""
    readings = MockDevice(seed=8400, inject_reference_failures=False).run_tests(
        [],
        focus_gate=0,
        focus_input_a=0,
        focus_input_b=0,
        sample_count=20,
    )

    summary = compute_spc_summary(readings)

    assert summary["groups"][0]["samples"] == 20
    assert len(summary["groups"][0]["bell_curve"]) >= 16
    assert summary["worst_group"] == summary["groups"][0]["group_id"]


def test_compute_spc_summary_flags_capability_issues() -> None:
    """Verify anomalies create SPC alerts."""
    readings = MockDevice().run_tests([])

    summary = compute_spc_summary(readings)

    assert summary["alerts"]
    assert summary["capable"] is False
