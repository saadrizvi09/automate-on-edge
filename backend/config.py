"""Configuration loading and Bedrock request helpers for the AI PVE agent."""

import os

import requests
from dotenv import load_dotenv

load_dotenv()

BEDROCK_API_KEY = os.getenv("BEDROCK_API_KEY")
BEDROCK_INVOKE_URL = os.getenv(
    "BEDROCK_INVOKE_URL",
    "https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-pro-v1:0/invoke",
)
ARDUINO_PORT = os.getenv("ARDUINO_PORT", "COM3")
ARDUINO_BOARD = os.getenv("ARDUINO_BOARD", "arduino:avr:uno")
ARDUINO_CLI_PATH = os.getenv("ARDUINO_CLI_PATH", "arduino-cli")


def ask_nova(prompt: str, max_tokens: int = 2048) -> str:
    """
    Send a prompt to AWS Bedrock Nova Pro and return the response text.

    Args:
        prompt: The full prompt string to send.
        max_tokens: Maximum number of tokens to request in the response.

    Returns:
        The response text from the model.

    Raises:
        ValueError: If the Bedrock API key is not configured.
        requests.Timeout: If the request exceeds 30 seconds.
        requests.ConnectionError: If the Bedrock API cannot be reached.
        RuntimeError: If the Bedrock API returns a non-200 status code.
    """
    if not BEDROCK_API_KEY:
        raise ValueError("BEDROCK_API_KEY not set in environment")

    try:
        response = requests.post(
            BEDROCK_INVOKE_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {BEDROCK_API_KEY}",
            },
            json={
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"maxTokens": max_tokens},
            },
            timeout=30,
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Bedrock API error {response.status_code}: {response.text}"
            )

        return response.json()["output"]["message"]["content"][0]["text"]
    except requests.Timeout as exc:
        raise requests.Timeout("Bedrock API timed out after 30 seconds") from exc
    except requests.ConnectionError as exc:
        raise requests.ConnectionError(
            "Cannot reach Bedrock API - check internet connection"
        ) from exc
