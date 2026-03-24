"""Tests for the Arduino script generator agent."""

from pathlib import Path
from unittest.mock import patch

from backend.agents.script_generator import SCRIPT_PATH, generate_arduino_script


@patch("backend.agents.script_generator.ask_nova")
def test_generate_arduino_script_returns_valid_code_and_saves_file(mock_ask_nova) -> None:
    """Verify generated Arduino code contains core structure and is saved to disk."""
    test_plan = [
        {
            "test_id": "TC-001",
            "requirement_id": "REQ-001",
            "test_name": "Output HIGH voltage test",
            "steps": ["Apply VCC=5V", "Set inputs A=1 B=1", "Measure output voltage"],
            "expected_result": "Voltage > 2.4V",
            "pass_criteria": "measured_voltage > 2.4",
        }
    ]
    mock_ask_nova.return_value = """void setup() {
  Serial.begin(9600);
}

void loop() {
}
"""

    script = generate_arduino_script(test_plan)

    assert "void setup()" in script
    assert "void loop()" in script
    assert "Serial.begin(9600)" in script
    assert "const int GATE0_INPUT_A = 2;" in script
    assert "Requirements tested:" in script
    assert Path(SCRIPT_PATH).exists()
    assert "void setup()" in Path(SCRIPT_PATH).read_text(encoding="utf-8")


@patch("backend.agents.script_generator.ask_nova")
def test_generate_arduino_script_falls_back_to_valid_template(mock_ask_nova) -> None:
    """Verify incomplete model output is replaced by a valid fallback sketch."""
    mock_ask_nova.return_value = "not valid arduino"

    script = generate_arduino_script([
        {
            "test_id": "TC-002",
            "requirement_id": "REQ-002",
            "test_name": "Output LOW voltage test",
            "steps": ["Apply VCC=5V", "Set inputs A=1 B=1", "Measure output voltage"],
            "expected_result": "Voltage < 0.4V",
            "pass_criteria": "measured_voltage < 0.4",
        }
    ])

    assert "void setup()" in script
    assert "void loop()" in script
    assert "Serial.begin(9600)" in script
