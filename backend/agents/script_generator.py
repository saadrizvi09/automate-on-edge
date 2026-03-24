"""Arduino script generator agent for producing flashable Uno test sketches."""

import json
from pathlib import Path

import requests

from backend.config import ask_nova

SCRIPT_GENERATOR_PROMPT_TEMPLATE = """You are an embedded systems engineer. Write an Arduino Uno C++ test script for the following test plan.

The device under test is a 7400 Quad NAND gate IC in a ZIF socket.
Pin mapping: Gate 0 inputs: D2,D3 output: A0 | Gate 1 inputs: D5,D6 output: A1 | Gate 2 inputs: D8,D9 output: A2 | Gate 3 inputs: D11,D12 output: A3
VCC = 5V. Analog reference = 5V. ADC formula: voltage = analogRead(pin) * (5.0 / 1023.0)

Output format for Serial.println: gate_number,input_a,input_b,measured_voltage,PASS_or_FAIL
Baud rate: 9600. Delay 10ms between each reading. Repeat all tests every 3 seconds.

Return ONLY the Arduino C++ code. No explanation. No markdown. No code blocks. Raw code only.

Test plan:
{test_plan_json}
"""

SCRIPT_PATH = Path("arduino/generated/test_script.ino")
PIN_DEFINITIONS = """const int GATE0_INPUT_A = 2;
const int GATE0_INPUT_B = 3;
const int GATE1_INPUT_A = 5;
const int GATE1_INPUT_B = 6;
const int GATE2_INPUT_A = 8;
const int GATE2_INPUT_B = 9;
const int GATE3_INPUT_A = 11;
const int GATE3_INPUT_B = 12;
const int GATE0_OUTPUT = A0;
const int GATE1_OUTPUT = A1;
const int GATE2_OUTPUT = A2;
const int GATE3_OUTPUT = A3;"""


def _strip_code_fences(script: str) -> str:
    """
    Remove markdown code fences if the model includes them.

    Args:
        script: Raw script text returned by the model.

    Returns:
        Cleaned Arduino C++ source text.
    """
    cleaned = script.strip()
    if cleaned.startswith("```"):
        lines = [line for line in cleaned.splitlines() if not line.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()
    return cleaned


def _build_header(test_plan: list[dict]) -> str:
    """
    Build the required script comment header listing tested requirements.

    Args:
        test_plan: Test-plan items used for script generation.

    Returns:
        A C-style comment header.
    """
    requirement_ids = sorted({item["requirement_id"] for item in test_plan})
    header_lines = ["/*", "Requirements tested:"] + [f"- {req_id}" for req_id in requirement_ids] + ["*/"]
    return "\n".join(header_lines)


def _fallback_script(test_plan: list[dict]) -> str:
    """
    Build a deterministic Arduino sketch when the model output is structurally incomplete.

    Args:
        test_plan: Test-plan items used for script generation.

    Returns:
        A valid Arduino C++ sketch string.
    """
    _ = test_plan
    header = _build_header(test_plan)
    return f"""{header}

{PIN_DEFINITIONS}

int gateInputPins[4][2] = {{
  {{GATE0_INPUT_A, GATE0_INPUT_B}},
  {{GATE1_INPUT_A, GATE1_INPUT_B}},
  {{GATE2_INPUT_A, GATE2_INPUT_B}},
  {{GATE3_INPUT_A, GATE3_INPUT_B}}
}};

int gateOutputPins[4] = {{GATE0_OUTPUT, GATE1_OUTPUT, GATE2_OUTPUT, GATE3_OUTPUT}};

float readVoltage(int pin) {{
  return analogRead(pin) * (5.0 / 1023.0);
}}

void setup() {{
  Serial.begin(9600);
  pinMode(GATE0_INPUT_A, OUTPUT);
  pinMode(GATE0_INPUT_B, OUTPUT);
  pinMode(GATE1_INPUT_A, OUTPUT);
  pinMode(GATE1_INPUT_B, OUTPUT);
  pinMode(GATE2_INPUT_A, OUTPUT);
  pinMode(GATE2_INPUT_B, OUTPUT);
  pinMode(GATE3_INPUT_A, OUTPUT);
  pinMode(GATE3_INPUT_B, OUTPUT);
}}

void emitReading(int gate, int inputA, int inputB) {{
  digitalWrite(gateInputPins[gate][0], inputA ? HIGH : LOW);
  digitalWrite(gateInputPins[gate][1], inputB ? HIGH : LOW);
  delay(10);
  float measuredVoltage = readVoltage(gateOutputPins[gate]);
  int expectedLow = (inputA == 1 && inputB == 1);
  int pass = expectedLow ? measuredVoltage < 0.4 : measuredVoltage > 2.4;
  Serial.print(gate);
  Serial.print(",");
  Serial.print(inputA);
  Serial.print(",");
  Serial.print(inputB);
  Serial.print(",");
  Serial.print(measuredVoltage, 3);
  Serial.print(",");
  Serial.println(pass ? "PASS" : "FAIL");
}}

void loop() {{
  for (int gate = 0; gate < 4; gate++) {{
    for (int inputA = 0; inputA <= 1; inputA++) {{
      for (int inputB = 0; inputB <= 1; inputB++) {{
        emitReading(gate, inputA, inputB);
        delay(10);
      }}
    }}
  }}
  delay(3000);
}}
"""


def _ensure_required_structure(script: str, test_plan: list[dict]) -> str:
    """
    Ensure the generated script contains the required header, pin map, and core functions.

    Args:
        script: Raw script text from the model.
        test_plan: Test-plan items used for script generation.

    Returns:
        A valid Arduino C++ sketch string.
    """
    cleaned = _strip_code_fences(script)
    required_snippets = ["void setup()", "void loop()", "Serial.begin(9600)"]
    if not all(snippet in cleaned for snippet in required_snippets):
        return _fallback_script(test_plan)

    header = _build_header(test_plan)
    parts = [cleaned]
    if "Requirements tested:" not in cleaned:
        parts.insert(0, header)
    if "const int GATE0_INPUT_A = 2;" not in cleaned:
        parts.insert(1 if len(parts) > 1 else 0, PIN_DEFINITIONS)
    return "\n\n".join(parts).strip() + "\n"


def generate_arduino_script(test_plan: list[dict]) -> str:
    """
    Generate and persist an Arduino Uno verification sketch from a test plan.

    Args:
        test_plan: Test-plan dictionaries matching the architecture schema.

    Returns:
        The generated Arduino C++ code as a string.

    Raises:
        RuntimeError: If the Bedrock request fails.
    """
    test_plan_json = json.dumps(test_plan, indent=2)
    prompt = SCRIPT_GENERATOR_PROMPT_TEMPLATE.format(test_plan_json=test_plan_json)
    retry_prompt = prompt + "\nReturn raw Arduino C++ only, with no markdown fences or explanation."

    raw_response = ""
    for current_prompt in (prompt, retry_prompt):
        try:
            raw_response = ask_nova(current_prompt)
        except requests.Timeout as exc:
            raise RuntimeError("Arduino script generation timed out while calling Bedrock") from exc
        except requests.ConnectionError as exc:
            raise RuntimeError("Arduino script generation could not reach Bedrock") from exc
        except RuntimeError as exc:
            raise RuntimeError(f"Arduino script generation Bedrock error: {exc}") from exc

        script = _ensure_required_structure(raw_response, test_plan)
        if "void setup()" in script and "void loop()" in script and "Serial.begin(9600)" in script:
            SCRIPT_PATH.parent.mkdir(parents=True, exist_ok=True)
            SCRIPT_PATH.write_text(script, encoding="utf-8")
            return script

    raise RuntimeError("Arduino script generation failed to produce a valid sketch")
