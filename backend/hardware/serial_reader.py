"""Serial reading utilities for collecting live Arduino test data."""

from __future__ import annotations

from datetime import datetime
import time
from typing import Iterator

import serial

from backend.analytics.statistics import enrich_reading, expected_state_from_inputs


SERIAL_BAUD_RATE = 9600
SERIAL_TIMEOUT_SECONDS = 30


def iter_serial_data(
    port: str,
    expected_count: int,
    focus_gate: int | None = None,
    focus_input_a: int | None = None,
    focus_input_b: int | None = None,
    phase: str = "initial",
) -> Iterator[dict]:
    """Yield parsed Arduino serial data as enriched reading dictionaries."""
    yielded_count = 0
    start_time = time.monotonic()
    connection = serial.Serial(port, SERIAL_BAUD_RATE, timeout=1)

    try:
        while yielded_count < expected_count:
            if time.monotonic() - start_time > SERIAL_TIMEOUT_SECONDS:
                raise TimeoutError("Timed out waiting for serial data from Arduino")

            raw_line = connection.readline()
            if not raw_line:
                continue

            decoded = raw_line.decode("utf-8").strip()
            parts = decoded.split(",")
            if len(parts) != 5:
                continue

            gate_text, input_a_text, input_b_text, voltage_text, result = parts
            gate = int(gate_text)
            input_a = int(input_a_text)
            input_b = int(input_b_text)
            if focus_gate is not None and gate != focus_gate:
                continue
            if focus_input_a is not None and input_a != focus_input_a:
                continue
            if focus_input_b is not None and input_b != focus_input_b:
                continue

            expected_state_from_inputs(input_a, input_b)
            yielded_count += 1
            yield enrich_reading(
                {
                    "test_id": f"TC-{yielded_count:03d}",
                    "gate": gate,
                    "input_a": input_a,
                    "input_b": input_b,
                    "measured_voltage": float(voltage_text),
                    "result": result,
                    "timestamp": datetime.utcnow().replace(microsecond=0).isoformat(),
                    "supply_voltage": 5.0,
                },
                source="hardware",
                phase=phase,
            )
    finally:
        connection.close()


def read_serial_data(
    port: str,
    expected_count: int,
    focus_gate: int | None = None,
    focus_input_a: int | None = None,
    focus_input_b: int | None = None,
    phase: str = "initial",
) -> list[dict]:
    """Read a finite number of Arduino serial lines and return structured readings."""
    return list(
        iter_serial_data(
            port=port,
            expected_count=expected_count,
            focus_gate=focus_gate,
            focus_input_a=focus_input_a,
            focus_input_b=focus_input_b,
            phase=phase,
        )
    )
