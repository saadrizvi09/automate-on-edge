"""Tests for the test planner agent."""

from unittest.mock import patch

from backend.agents.test_planner import TEST_PLANNER_PROMPT_TEMPLATE, _parse_test_plan, generate_test_plan


@patch("backend.agents.test_planner.ask_nova")
def test_generate_test_plan_returns_parsed_json(mock_ask_nova) -> None:
    """Verify test-plan generation parses a mocked Nova response."""
    requirements = [
        {
            "id": "REQ-001",
            "description": "Output HIGH voltage must be greater than 2.4V",
            "acceptance_criteria": "> 2.4V",
            "test_method": "Apply HIGH inputs and measure output voltage",
        }
    ]
    mock_ask_nova.return_value = (
        '[{"test_id": "TC-001", "requirement_id": "REQ-001", '
        '"test_name": "Output HIGH voltage test", '
        '"steps": ["Apply VCC=5V", "Set inputs A=1 B=1", "Measure output voltage"], '
        '"expected_result": "Voltage > 2.4V", "pass_criteria": "measured_voltage > 2.4"}]'
    )

    test_plan = generate_test_plan(requirements)

    assert test_plan[0]["test_id"] == "TC-001"
    assert "REQ-001" in mock_ask_nova.call_args.args[0]
    assert TEST_PLANNER_PROMPT_TEMPLATE.splitlines()[0] in mock_ask_nova.call_args.args[0]


@patch("backend.agents.test_planner.ask_nova")
def test_generate_test_plan_retries_once_when_json_is_invalid(mock_ask_nova) -> None:
    """Verify invalid JSON triggers one stricter retry before succeeding."""
    mock_ask_nova.side_effect = [
        "not-json",
        '[{"test_id": "TC-002", "requirement_id": "REQ-002", '
        '"test_name": "Output LOW voltage test", '
        '"steps": ["Apply VCC=5V", "Set inputs A=1 B=1", "Measure output voltage"], '
        '"expected_result": "Voltage < 0.4V", "pass_criteria": "measured_voltage < 0.4"}]',
    ]

    test_plan = generate_test_plan([
        {
            "id": "REQ-002",
            "description": "Output LOW voltage must be less than 0.4V",
            "acceptance_criteria": "< 0.4V",
            "test_method": "Apply HIGH inputs and measure LOW output",
        }
    ])

    assert len(test_plan) == 1
    assert mock_ask_nova.call_count == 2
    assert "invalid JSON" in mock_ask_nova.call_args_list[1].args[0]


def test_parse_test_plan_accepts_fenced_wrapper_with_extra_fields() -> None:
    """Verify parser tolerates markdown fences, object wrappers, and extra keys."""
    raw_response = """```json
    {
      "test_plan": [
        {
          "test_id": "TC-001",
          "requirement_id": "REQ-001",
          "test_name": "Output HIGH voltage test",
          "steps": ["Apply VCC=5V", "Set inputs A=1 B=1", "Measure output voltage"],
          "expected_result": "Voltage > 2.4V",
          "pass_criteria": "measured_voltage > 2.4",
          "notes": "extra metadata"
        }
      ]
    }
    ```"""

    parsed = _parse_test_plan(raw_response)

    assert parsed == [
        {
            "test_id": "TC-001",
            "requirement_id": "REQ-001",
            "test_name": "Output HIGH voltage test",
            "steps": ["Apply VCC=5V", "Set inputs A=1 B=1", "Measure output voltage"],
            "expected_result": "Voltage > 2.4V",
            "pass_criteria": "measured_voltage > 2.4",
        }
    ]


@patch("backend.agents.test_planner.ask_nova")
def test_generate_test_plan_falls_back_to_deterministic_plan_after_two_invalid_responses(mock_ask_nova) -> None:
    """Verify the pipeline still gets a usable test plan when the model format drifts."""
    mock_ask_nova.side_effect = ["still not json", "```oops```"]

    test_plan = generate_test_plan([
        {
            "id": "REQ-003",
            "description": "Output HIGH voltage must be greater than 2.4V under nominal load",
            "acceptance_criteria": "> 2.4V",
            "test_method": "Apply HIGH inputs; measure output voltage",
        }
    ])

    assert mock_ask_nova.call_count == 2
    assert test_plan == [
        {
            "test_id": "TC-001",
            "requirement_id": "REQ-003",
            "test_name": "Output HIGH voltage must be greater than 2.4V under nominal load",
            "steps": ["Apply HIGH inputs", "measure output voltage"],
            "expected_result": "> 2.4V",
            "pass_criteria": "measured_voltage > 2.4",
        }
    ]
