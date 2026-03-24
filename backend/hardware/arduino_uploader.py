"""Arduino uploader utilities built around the arduino-cli command line tool."""

import subprocess
from pathlib import Path

from backend.config import ARDUINO_CLI_PATH


def upload_to_arduino(script_path: str, port: str, board: str) -> dict:
    """
    Compile and upload an Arduino sketch using arduino-cli.

    Args:
        script_path: Path to the generated `.ino` sketch file.
        port: Serial port where the Arduino is connected.
        board: Arduino board FQBN string.

    Returns:
        A result dictionary containing status and message fields.
    """
    sketch_path = Path(script_path)
    sketch_dir = str(sketch_path.parent)

    try:
        compile_result = subprocess.run(
            [ARDUINO_CLI_PATH, "compile", "--fqbn", board, sketch_dir],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return {"status": "error", "message": "arduino-cli executable not found"}

    if compile_result.returncode != 0:
        message = compile_result.stderr.strip() or compile_result.stdout.strip() or "Arduino compile failed"
        return {"status": "error", "message": message}

    upload_result = subprocess.run(
        [ARDUINO_CLI_PATH, "upload", "-p", port, "--fqbn", board, sketch_dir],
        capture_output=True,
        text=True,
        check=False,
    )
    if upload_result.returncode != 0:
        message = upload_result.stderr.strip() or upload_result.stdout.strip() or "Arduino upload failed"
        return {"status": "error", "message": message}

    return {"status": "success", "message": "Arduino sketch compiled and uploaded successfully"}
