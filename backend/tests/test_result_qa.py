"""Tests for natural-language Q&A over results."""

from unittest.mock import patch

from backend.agents.result_qa import answer_results_question


@patch("backend.agents.result_qa.ask_nova", side_effect=ValueError("no key"))
def test_answer_results_question_uses_fallback_for_thermal_question(mock_ask_nova) -> None:
    """Verify thermal-risk questions are answered from deterministic evidence when the LLM is unavailable."""
    answer = answer_results_question(
        "Which gate is most likely to fail first under thermal stress?",
        {
            "total_tests": 16,
            "failed": 2,
            "spc_summary": {"groups": [{"group_id": "Gate 2 A=1 B=1", "cpk": 0.8, "mean_voltage": 0.51}]},
            "failures": [],
        },
        [],
        [{"id": "REQ-001", "description": "Output HIGH voltage must be greater than 2.4V"}],
        [],
        {"predicted_hotspot_gate": 2, "trend_summary": "Gate 2 is the batch hotspot."},
    )

    assert "Gate 2" in answer["answer"]
    assert answer["citations"][0]["kind"] == "batch"
    assert mock_ask_nova.called
