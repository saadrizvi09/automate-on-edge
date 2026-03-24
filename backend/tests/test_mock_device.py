"""Tests for the mock device simulator."""

from backend.simulator.mock_device import MockDevice


def test_mock_device_injects_exactly_two_reference_failures() -> None:
    """Verify the default simulator run still contains the two reference anomalies."""
    readings = MockDevice().run_tests([])

    failures = [reading for reading in readings if reading["result"] == "FAIL"]

    assert len(failures) == 2
    assert any(
        reading["gate"] == 2 and reading["input_a"] == 1 and reading["input_b"] == 1 and reading["measured_voltage"] == 0.62
        for reading in failures
    )
    assert any(
        reading["gate"] == 3 and reading["input_a"] == 0 and reading["input_b"] == 0 and reading["measured_voltage"] == 2.1
        for reading in failures
    )


def test_mock_device_can_generate_focused_follow_up_samples() -> None:
    """Verify focused runs produce repeated samples for one condition."""
    readings = MockDevice(seed=8400, inject_reference_failures=False).run_tests(
        [],
        focus_gate=2,
        focus_input_a=1,
        focus_input_b=1,
        sample_count=12,
        phase="follow_up",
    )

    assert len(readings) == 12
    assert all(reading["gate"] == 2 for reading in readings)
    assert all(reading["phase"] == "follow_up" for reading in readings)
    assert {reading["expected_state"] for reading in readings} == {"LOW"}


def test_mock_device_readings_include_enriched_schema_fields() -> None:
    """Verify each simulated reading contains the enriched schema fields."""
    readings = MockDevice().run_tests([])

    assert len(readings) == 16
    assert {
        "test_id",
        "gate",
        "input_a",
        "input_b",
        "measured_voltage",
        "expected_state",
        "expected_voltage_min",
        "expected_voltage_max",
        "spec_limit",
        "result",
        "source",
        "phase",
        "batch_id",
        "timestamp",
        "is_anomaly",
        "violation_margin",
        "supply_voltage",
    }.issubset(readings[0].keys())
