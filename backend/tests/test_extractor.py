"""Tests for PDF extraction and requirement extraction."""

from unittest.mock import patch

import fitz

from backend.agents.extractor import EXTRACTOR_PROMPT_TEMPLATE, extract_requirements, extract_text_from_pdf


def _build_sample_pdf_bytes() -> bytes:
    """Create an in-memory PDF fixture containing simple datasheet text."""
    document = fitz.open()
    page = document.new_page()
    page.insert_text(
        (72, 72),
        "7400 NAND Gate Datasheet\nOutput HIGH voltage must be greater than 2.4V\nOutput LOW voltage must be less than 0.4V",
    )
    pdf_bytes = document.tobytes()
    document.close()
    return pdf_bytes


def test_extract_text_from_pdf_returns_text_from_pdf_bytes() -> None:
    """Verify PDF bytes are converted into readable text."""
    pdf_bytes = _build_sample_pdf_bytes()

    extracted_text = extract_text_from_pdf(pdf_bytes)

    assert "7400 NAND Gate Datasheet" in extracted_text
    assert "greater than 2.4V" in extracted_text


@patch("backend.agents.extractor.ask_nova")
def test_extract_requirements_returns_parsed_json(mock_ask_nova) -> None:
    """Verify requirement extraction parses a mocked Nova JSON response."""
    pdf_text = "Output HIGH voltage must be greater than 2.4V"
    mock_ask_nova.return_value = (
        '[{"id": "REQ-001", "description": "Output HIGH voltage must be greater than 2.4V", '
        '"acceptance_criteria": "> 2.4V", "test_method": "Apply HIGH inputs and measure output voltage"}]'
    )

    requirements = extract_requirements(pdf_text)

    assert requirements[0]["id"] == "REQ-001"
    assert EXTRACTOR_PROMPT_TEMPLATE.format(spec_text=pdf_text) == mock_ask_nova.call_args.args[0]


@patch("backend.agents.extractor.ask_nova")
def test_extract_requirements_retries_once_when_json_is_invalid(mock_ask_nova) -> None:
    """Verify invalid JSON triggers one stricter retry before succeeding."""
    mock_ask_nova.side_effect = [
        "not-json",
        '[{"id": "REQ-002", "description": "Output LOW voltage must be less than 0.4V", '
        '"acceptance_criteria": "< 0.4V", "test_method": "Apply HIGH inputs and measure LOW output"}]',
    ]

    requirements = extract_requirements("Output LOW voltage must be less than 0.4V")

    assert len(requirements) == 1
    assert mock_ask_nova.call_count == 2
    assert "invalid JSON" in mock_ask_nova.call_args_list[1].args[0]
