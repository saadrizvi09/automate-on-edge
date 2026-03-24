"""Tests for agentic follow-up planning."""

from backend.agents.follow_up import plan_follow_up_tests, summarize_follow_up_runs
from backend.analytics.statistics import compute_spc_summary
from backend.simulator.mock_device import MockDevice


def test_plan_follow_up_tests_targets_failing_conditions() -> None:
    """Verify failing readings produce targeted follow-up plans."""
    readings = MockDevice().run_tests([])

    plans = plan_follow_up_tests(readings, compute_spc_summary(readings))

    assert plans
    assert plans[0]["sample_count"] == 50
    assert plans[0]["priority"] == "HIGH"


def test_summarize_follow_up_runs_counts_executed_samples() -> None:
    """Verify follow-up summary reports executed runs."""
    summary = summarize_follow_up_runs([
        {"executed": True, "readings": [{"test_id": "TC-001"}] * 10},
        {"executed": True, "readings": [{"test_id": "TC-002"}] * 5},
    ])

    assert "2 targeted follow-up run(s)" in summary
    assert "15 additional readings" in summary
