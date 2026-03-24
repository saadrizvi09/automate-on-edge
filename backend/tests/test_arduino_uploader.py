"""Tests for the Arduino uploader module."""

import subprocess
from unittest.mock import Mock, patch

from backend.hardware.arduino_uploader import upload_to_arduino


@patch("backend.hardware.arduino_uploader.subprocess.run")
def test_upload_to_arduino_returns_success_when_compile_and_upload_succeed(mock_run) -> None:
    """Verify successful compile and upload return a success payload."""
    mock_run.side_effect = [
        Mock(returncode=0, stdout="compile ok", stderr=""),
        Mock(returncode=0, stdout="upload ok", stderr=""),
    ]

    result = upload_to_arduino("arduino/generated/test_script.ino", "COM3", "arduino:avr:uno")

    assert result["status"] == "success"
    assert mock_run.call_count == 2


@patch("backend.hardware.arduino_uploader.subprocess.run")
def test_upload_to_arduino_returns_error_when_compile_fails(mock_run) -> None:
    """Verify compile failures return an error payload and stop before upload."""
    mock_run.return_value = Mock(returncode=1, stdout="", stderr="compile failed")

    result = upload_to_arduino("arduino/generated/test_script.ino", "COM3", "arduino:avr:uno")

    assert result == {"status": "error", "message": "compile failed"}
    assert mock_run.call_count == 1


@patch("backend.hardware.arduino_uploader.subprocess.run")
def test_upload_to_arduino_returns_error_when_upload_fails(mock_run) -> None:
    """Verify upload failures return an error payload after a successful compile."""
    mock_run.side_effect = [
        Mock(returncode=0, stdout="compile ok", stderr=""),
        Mock(returncode=1, stdout="", stderr="upload failed"),
    ]

    result = upload_to_arduino("arduino/generated/test_script.ino", "COM3", "arduino:avr:uno")

    assert result == {"status": "error", "message": "upload failed"}
    assert mock_run.call_count == 2


@patch("backend.hardware.arduino_uploader.subprocess.run", side_effect=FileNotFoundError)
def test_upload_to_arduino_returns_error_when_cli_is_missing(mock_run) -> None:
    """Verify a missing arduino-cli executable returns an error payload."""
    result = upload_to_arduino("arduino/generated/test_script.ino", "COM3", "arduino:avr:uno")

    assert result == {"status": "error", "message": "arduino-cli executable not found"}
    assert mock_run.call_count == 1
