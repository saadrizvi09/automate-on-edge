"""Tests for the report writer agent."""

from unittest.mock import patch

from backend.agents.report_writer import write_report_narrative


@patch("backend.agents.report_writer.ask_nova")
def test_write_report_narrative_returns_string_from_json_response(mock_ask_nova) -> None:
    """Verify the report writer returns the narrative field from the model response."""
    mock_ask_nova.return_value = '{"narrative": "The device passed most tests and requires follow-up on two failing cases."}'

    narrative = write_report_narrative(
        {"overall_result": "FAIL", "total_tests": 16, "passed": 14, "failed": 2, "failures": [], "summary": "summary"},
        [],
        [],
    )

    assert "requires follow-up" in narrative


@patch("backend.agents.report_writer.ask_nova")
def test_write_report_narrative_retries_once_when_json_is_invalid(mock_ask_nova) -> None:
    """Verify invalid JSON triggers one stricter retry before succeeding."""
    mock_ask_nova.side_effect = ["not-json", '{"narrative": "Recovered narrative."}']

    narrative = write_report_narrative(
        {"overall_result": "FAIL", "total_tests": 16, "passed": 14, "failed": 2, "failures": [], "summary": "summary"},
        [],
        [],
    )

    assert narrative == "Recovered narrative."
    assert mock_ask_nova.call_count == 2
