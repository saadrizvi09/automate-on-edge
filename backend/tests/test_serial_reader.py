"""Tests for the serial reader module."""

from unittest.mock import patch

import pytest

from backend.hardware.serial_reader import iter_serial_data, read_serial_data


class FakeSerial:
    """Minimal fake serial connection for testing serial reads."""

    def __init__(self, lines: list[bytes]) -> None:
        self._lines = list(lines)
        self.closed = False

    def readline(self) -> bytes:
        if self._lines:
            return self._lines.pop(0)
        return b""

    def close(self) -> None:
        self.closed = True


@patch("backend.hardware.serial_reader.serial.Serial")
def test_read_serial_data_parses_csv_lines(mock_serial) -> None:
    """Verify serial CSV lines are parsed into enriched reading dictionaries."""
    fake_serial = FakeSerial([
        b"0,1,1,0.31,PASS\n",
        b"1,0,0,4.82,PASS\n",
    ])
    mock_serial.return_value = fake_serial

    readings = read_serial_data("COM3", expected_count=2)

    assert len(readings) == 2
    assert readings[0]["gate"] == 0
    assert readings[0]["measured_voltage"] == 0.31
    assert readings[1]["expected_voltage_min"] == 2.4
    assert readings[0]["source"] == "hardware"
    assert fake_serial.closed is True


@patch("backend.hardware.serial_reader.serial.Serial")
def test_iter_serial_data_can_filter_follow_up_condition(mock_serial) -> None:
    """Verify focused serial reads only yield the requested gate/input condition."""
    fake_serial = FakeSerial([
        b"0,0,0,4.90,PASS\n",
        b"2,1,1,0.42,FAIL\n",
        b"2,1,1,0.41,FAIL\n",
    ])
    mock_serial.return_value = fake_serial

    readings = list(iter_serial_data("COM3", expected_count=2, focus_gate=2, focus_input_a=1, focus_input_b=1, phase="follow_up"))

    assert len(readings) == 2
    assert all(reading["phase"] == "follow_up" for reading in readings)
    assert all(reading["gate"] == 2 for reading in readings)


@patch("backend.hardware.serial_reader.serial.Serial")
@patch("backend.hardware.serial_reader.time.monotonic")
def test_read_serial_data_times_out_when_expected_count_is_not_received(mock_monotonic, mock_serial) -> None:
    """Verify serial reads time out after 30 seconds without enough data."""
    fake_serial = FakeSerial([])
    mock_serial.return_value = fake_serial
    mock_monotonic.side_effect = [0, 10, 20, 31]

    with pytest.raises(TimeoutError):
        read_serial_data("COM3", expected_count=1)

    assert fake_serial.closed is True
