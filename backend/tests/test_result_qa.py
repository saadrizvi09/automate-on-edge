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


@patch("backend.agents.result_qa.ask_nova", side_effect=ValueError("no key"))
def test_answer_results_question_surfaces_rejection_reason_and_coverage_gap(mock_ask_nova) -> None:
    """Verify rejection questions cite both the leading failure and the current coverage gap."""
    answer = answer_results_question(
        "Why did you reject this chip?",
        {
            "total_tests": 16,
            "failed": 2,
            "spc_summary": {"groups": []},
            "failures": [
                {
                    "test_id": "TC-012",
                    "description": "Gate 2 output LOW voltage out of spec",
                }
            ],
        },
        [],
        [{"id": "REQ-001", "description": "Output LOW voltage must be less than 0.4V"}],
        [],
        None,
        {"gaps": ["REQ-004 is mapped but not yet exercised under timing conditions."]},
        {"next_action": "Quarantine the DUT and collect timing evidence before release."},
    )

    assert "TC-012" in answer["answer"]
    assert any(citation["kind"] == "coverage" for citation in answer["citations"])
    assert mock_ask_nova.called
