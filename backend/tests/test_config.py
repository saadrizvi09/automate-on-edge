"""Tests for model routing configuration helpers."""

from unittest.mock import Mock, patch

import backend.config as config


def _mock_response(status_code: int, payload: dict, text: str = "") -> Mock:
    response = Mock()
    response.status_code = status_code
    response.json.return_value = payload
    response.text = text or str(payload)
    return response


@patch("backend.config.requests.post")
def test_ask_nova_prefers_groq_when_configured(mock_post: Mock) -> None:
    """Verify Groq is used as the primary provider when a Groq key is configured."""
    groq_response = _mock_response(
        200,
        {"choices": [{"message": {"content": "groq-success"}}]},
    )
    mock_post.return_value = groq_response

    with patch.object(config, "GROQ_API_KEY", "groq-key"), patch.object(config, "BEDROCK_API_KEY", "bedrock-key"):
        result = config.ask_nova("hello", max_tokens=32)

    assert result == "groq-success"
    assert mock_post.call_args.kwargs["json"]["model"] == config.GROQ_MODEL
    status = config.get_model_status()
    assert status["active_provider"] == "Groq"
    assert status["fallback_used"] is False


@patch("backend.config.requests.post")
def test_ask_nova_falls_back_to_bedrock_when_groq_limit_is_reached(mock_post: Mock) -> None:
    """Verify Bedrock is only used after Groq returns a limit/spend response."""
    groq_limit = _mock_response(
        429,
        {"error": {"code": "rate_limit_exceeded", "message": "Rate limit exceeded"}},
        text='{"error":{"code":"rate_limit_exceeded"}}',
    )
    bedrock_success = _mock_response(
        200,
        {"output": {"message": {"content": [{"text": "bedrock-fallback"}]}}},
    )
    mock_post.side_effect = [groq_limit, bedrock_success]

    with patch.object(config, "GROQ_API_KEY", "groq-key"), patch.object(config, "BEDROCK_API_KEY", "bedrock-key"):
        result = config.ask_nova("hello", max_tokens=32)

    assert result == "bedrock-fallback"
    assert mock_post.call_count == 2
    status = config.get_model_status()
    assert status["active_provider"] == "AWS Bedrock"
    assert status["fallback_used"] is True
    assert "GROQ_LIMIT_REACHED" in (status["last_error"] or "")
