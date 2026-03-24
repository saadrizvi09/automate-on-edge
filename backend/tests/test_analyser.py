"""Tests for the results analyser agent."""

from unittest.mock import patch

from backend.agents.analyser import analyse_results
from backend.simulator.mock_device import MockDevice


@patch("backend.agents.analyser.ask_nova")
def test_analyse_results_returns_failures_spc_and_follow_up(mock_ask_nova) -> None:
    """Verify the analyser adds deterministic SPC and follow-up planning."""
    mock_ask_nova.return_value = '{"summary": "Initial summary."}'
    readings = MockDevice().run_tests([])

    analysis = analyse_results(readings, [])

    assert analysis["overall_result"] == "FAIL"
    assert analysis["failed"] == 2
    assert len(analysis["failures"]) == 2
    assert analysis["spc_summary"]["groups"]
    assert analysis["follow_up_plan"]
    assert analysis["anomaly_highlights"]


@patch("backend.agents.analyser.ask_nova")
def test_analyse_results_falls_back_when_model_json_is_invalid(mock_ask_nova) -> None:
    """Verify invalid JSON does not break deterministic analysis output."""
    mock_ask_nova.side_effect = ["not-json", "still-not-json"]

    analysis = analyse_results(MockDevice().run_tests([]), [])

    assert analysis["failed"] == 2
    assert analysis["follow_up_plan"][0]["sample_count"] == 50
    assert mock_ask_nova.call_count == 2
