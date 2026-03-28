"""Integration tests for FastAPI API routes."""

from unittest.mock import patch

import fitz
import httpx
import pytest

from backend.main import app


@pytest.fixture
def anyio_backend() -> str:
    """Force anyio tests to run on asyncio only."""
    return "asyncio"


def _build_sample_pdf_bytes() -> bytes:
    """Create an in-memory PDF fixture containing datasheet text."""
    document = fitz.open()
    page = document.new_page()
    page.insert_text(
        (72, 72),
        "7400 NAND Gate Datasheet\nOutput HIGH voltage must be greater than 2.4V\nOutput LOW voltage must be less than 0.4V",
    )
    pdf_bytes = document.tobytes()
    document.close()
    return pdf_bytes


@pytest.mark.anyio
async def test_extract_requirements_route_returns_success() -> None:
    """Verify the extract requirements route returns requirements, conflicts, and document metadata."""
    with patch("backend.main.create_run_record", return_value="run-123"), patch(
        "backend.agents.extractor.ask_nova",
        return_value='[{"id": "REQ-001", "description": "Output HIGH voltage must be greater than 2.4V", "acceptance_criteria": "> 2.4V", "test_method": "Apply HIGH inputs and measure output voltage"}]',
    ):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.post(
                "/api/extract-requirements",
                content=_build_sample_pdf_bytes(),
                headers={"Content-Type": "application/pdf"},
            )

    payload = response.json()
    assert response.status_code == 200
    assert payload["status"] == "success"
    assert payload["data"]["requirements"][0]["id"] == "REQ-001"
    assert payload["data"]["conflicts"] == []
    assert payload["data"]["document"]["page_count"] == 1
    assert payload["data"]["document"]["character_count"] > 0
    assert payload["data"]["document"]["approximate_input_tokens"] > 0
    assert payload["data"]["run_id"] == "run-123"


@pytest.mark.anyio
async def test_extract_requirements_route_supports_cors_preflight() -> None:
    """Verify browser preflight requests succeed for the PDF upload endpoint."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.options(
            "/api/extract-requirements",
            headers={
                "Origin": "http://127.0.0.1:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"
    assert "POST" in response.headers["access-control-allow-methods"]


@pytest.mark.anyio
async def test_generate_test_plan_route_returns_success() -> None:
    """Verify the generate test plan route returns the standard JSON structure."""
    with patch(
        "backend.agents.test_planner.ask_nova",
        return_value='[{"test_id": "TC-001", "requirement_id": "REQ-001", "test_name": "Output HIGH voltage test", "steps": ["Apply VCC=5V", "Set inputs A=1 B=1", "Measure output voltage"], "expected_result": "Voltage > 2.4V", "pass_criteria": "measured_voltage > 2.4"}]',
    ):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.post(
                "/api/generate-test-plan",
                json={
                    "requirements": [
                        {
                            "id": "REQ-001",
                            "description": "Output HIGH voltage must be greater than 2.4V",
                            "acceptance_criteria": "> 2.4V",
                            "test_method": "Apply HIGH inputs and measure output voltage",
                        }
                    ]
                },
            )

    payload = response.json()
    assert response.status_code == 200
    assert payload["data"]["test_plan"][0]["test_id"] == "TC-001"


@pytest.mark.anyio
async def test_generate_script_route_returns_success() -> None:
    """Verify the generate script route returns the standard JSON structure."""
    with patch(
        "backend.agents.script_generator.ask_nova",
        return_value="void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n}\n",
    ):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.post(
                "/api/generate-script",
                json={
                    "test_plan": [
                        {
                            "test_id": "TC-001",
                            "requirement_id": "REQ-001",
                            "test_name": "Output HIGH voltage test",
                            "steps": ["Apply VCC=5V", "Set inputs A=1 B=1", "Measure output voltage"],
                            "expected_result": "Voltage > 2.4V",
                            "pass_criteria": "measured_voltage > 2.4",
                        }
                    ]
                },
            )

    payload = response.json()
    assert response.status_code == 200
    assert "void setup()" in payload["data"]["script"]


@pytest.mark.anyio
async def test_flash_arduino_route_returns_success() -> None:
    """Verify the flash Arduino route returns the standard JSON structure."""
    with patch(
        "backend.main.upload_to_arduino",
        return_value={"status": "success", "message": "Arduino sketch compiled and uploaded successfully"},
    ):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.post(
                "/api/flash-arduino",
                json={"script": "void setup() {}\nvoid loop() {}", "port": "COM3", "board": "arduino:avr:uno"},
            )

    payload = response.json()
    assert response.status_code == 200
    assert payload["data"]["status"] == "success"


@pytest.mark.anyio
async def test_run_hardware_route_returns_success() -> None:
    """Verify the hardware route returns parsed readings in the standard JSON structure."""
    with patch(
        "backend.main.read_serial_data",
        return_value=[
            {
                "test_id": "TC-001",
                "gate": 0,
                "input_a": 1,
                "input_b": 1,
                "measured_voltage": 0.31,
                "expected_state": "LOW",
                "expected_voltage_min": 0.0,
                "expected_voltage_max": 0.4,
                "spec_limit": "< 0.4V",
                "result": "PASS",
                "source": "hardware",
                "phase": "initial",
                "batch_id": None,
                "timestamp": "2024-01-01T10:00:00",
                "is_anomaly": False,
                "violation_margin": 0.0,
                "supply_voltage": 5.0,
            }
        ],
    ):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.post("/api/run-hardware", json={"port": "COM3", "expected_count": 1})

    payload = response.json()
    assert response.status_code == 200
    assert len(payload["data"]["readings"]) == 1


@pytest.mark.anyio
async def test_run_simulation_route_returns_success() -> None:
    """Verify the simulation route returns the standard JSON structure."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.post("/api/run-simulation", json={"test_plan": []})

    payload = response.json()
    assert response.status_code == 200
    assert len(payload["data"]["readings"]) == 16
    assert payload["data"]["readings"][0]["source"] == "simulation"


@pytest.mark.anyio
async def test_stream_execution_route_emits_reading_and_complete_events() -> None:
    """Verify the live stream endpoint emits NDJSON events."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.post("/api/stream-execution", json={"mode": "simulation", "test_plan": [], "expected_count": 4})

    assert response.status_code == 200
    assert '"event": "reading"' in response.text
    assert '"event": "complete"' in response.text


@pytest.mark.anyio
async def test_analyse_results_route_returns_success() -> None:
    """Verify the analyse route returns the expanded analysis structure."""
    with patch(
        "backend.agents.analyser.ask_nova",
        return_value='{"summary": "Summary."}',
    ):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.post(
                "/api/analyse-results",
                json={"readings": [], "test_plan": []},
            )

    payload = response.json()
    assert response.status_code == 200
    assert payload["data"]["analysis"]["failed"] == 0
    assert payload["data"]["analysis"]["spc_summary"]["groups"] == []


@pytest.mark.anyio
async def test_run_follow_up_route_returns_runs() -> None:
    """Verify follow-up execution returns executed runs."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.post(
            "/api/run-follow-up",
            json={
                "mode": "simulation",
                "test_plan": [],
                "follow_up_plan": [
                    {"plan_id": "FU-001", "gate": 2, "input_a": 1, "input_b": 1, "sample_count": 6, "rationale": "test"}
                ],
            },
        )

    payload = response.json()
    assert response.status_code == 200
    assert payload["data"]["runs"][0]["executed"] is True
    assert len(payload["data"]["runs"][0]["readings"]) == 6


@pytest.mark.anyio
async def test_run_batch_analysis_route_returns_summary() -> None:
    """Verify batch analysis route returns predictive drift data."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.post("/api/run-batch-analysis", json={"test_plan": [], "batch_count": 5})

    payload = response.json()
    assert response.status_code == 200
    assert payload["data"]["batch_analysis"]["batch_count"] == 5


@pytest.mark.anyio
async def test_ask_results_route_returns_answer() -> None:
    """Verify results Q&A returns an answer payload."""
    with patch("backend.agents.result_qa.ask_nova", side_effect=ValueError("no key")):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.post(
                "/api/ask-results",
                json={
                    "question": "Why did you reject this chip?",
                    "analysis": {
                        "total_tests": 16,
                        "failed": 2,
                        "spc_summary": {"groups": []},
                        "failures": [
                            {
                                "test_id": "TC-012",
                                "description": "Gate 2 output LOW voltage out of spec",
                            }
                        ],
                    },
                    "readings": [],
                    "requirements": [],
                    "test_plan": [],
                    "coverage_summary": {"gaps": ["REQ-004 is mapped but not yet exercised under timing conditions."]},
                    "decision_state": {"next_action": "Quarantine the DUT and collect timing evidence before release."},
                },
            )

    payload = response.json()
    assert response.status_code == 200
    assert "reject" in payload["data"]["response"]["answer"].lower()
    assert any(citation["kind"] == "coverage" for citation in payload["data"]["response"]["citations"])


@pytest.mark.anyio
async def test_generate_report_route_returns_pdf_download() -> None:
    """Verify the report route returns a downloadable PDF response."""
    with patch(
        "backend.agents.report_writer.ask_nova",
        return_value='{"narrative": "Professional report narrative."}',
    ):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.post(
                "/api/generate-report",
                json={
                    "analysis": {
                        "overall_result": "FAIL",
                        "total_tests": 16,
                        "passed": 14,
                        "failed": 2,
                        "failures": [
                            {
                                "test_id": "TC-003",
                                "description": "Gate 2 output LOW voltage out of spec",
                                "measured": "0.62V",
                                "spec": "< 0.4V",
                                "severity": "HIGH",
                                "root_cause": "Possible internal gate degradation",
                                "recommendation": "Replace IC and retest.",
                            }
                        ],
                        "summary": "Summary.",
                        "spc_summary": {"groups": [], "worst_group": None, "alerts": [], "capable": False},
                        "follow_up_plan": [],
                        "anomaly_highlights": [],
                    },
                    "requirements": [
                        {
                            "id": "REQ-001",
                            "description": "Output HIGH voltage must be greater than 2.4V",
                            "acceptance_criteria": "> 2.4V",
                            "test_method": "Apply HIGH inputs and measure output voltage",
                        }
                    ],
                    "test_plan": [],
                    "conflicts": [],
                    "follow_up_runs": [],
                },
            )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


@pytest.mark.anyio
async def test_health_route_returns_ok_status() -> None:
    """Verify the health route returns the standard success structure."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.get("/api/health")

    payload = response.json()
    assert response.status_code == 200
    assert payload == {"status": "success", "data": {"status": "ok"}, "message": "Service healthy"}


@pytest.mark.anyio
async def test_model_status_route_returns_current_routing_stack() -> None:
    """Verify the model-status route exposes the configured routing stack for the frontend."""
    with patch(
        "backend.main.get_model_status",
        return_value={
            "primary_provider": "Groq",
            "primary_model": "meta-llama/llama-4-scout-17b-16e-instruct",
            "fallback_provider": "AWS Bedrock",
            "fallback_model": "amazon.nova-pro-v1:0",
            "active_provider": "Groq",
            "active_model": "meta-llama/llama-4-scout-17b-16e-instruct",
            "fallback_used": False,
            "last_error": None,
            "routing_mode": "Groq primary with Bedrock fallback on Groq rate/spend limit",
        },
    ):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.get("/api/model-status")

    payload = response.json()
    assert response.status_code == 200
    assert payload["data"]["model"]["primary_provider"] == "Groq"
    assert payload["data"]["model"]["fallback_provider"] == "AWS Bedrock"


@pytest.mark.anyio
async def test_get_run_route_returns_persisted_record() -> None:
    """Verify the persisted run route returns a stored run and event log."""
    with patch(
        "backend.main.fetch_run_record",
        return_value={
            "run_id": "run-123",
            "mode": "hardware",
            "current_stage": "analysis",
            "events": [{"stage": "requirements", "event_type": "requirements_extracted", "payload": {"requirements": 4}}],
        },
    ):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.get("/api/runs/run-123")

    payload = response.json()
    assert response.status_code == 200
    assert payload["data"]["run"]["run_id"] == "run-123"
    assert payload["data"]["run"]["events"][0]["event_type"] == "requirements_extracted"

