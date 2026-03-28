"""FastAPI application entrypoint and API route registration."""

from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from backend.agents.analyser import analyse_results
from backend.agents.conflict_detector import detect_requirement_conflicts
from backend.agents.extractor import extract_pdf_context, extract_requirements
from backend.agents.follow_up import summarize_follow_up_runs
from backend.agents.report_writer import write_report_narrative
from backend.agents.result_qa import answer_results_question
from backend.agents.script_generator import SCRIPT_PATH, generate_arduino_script
from backend.agents.test_planner import generate_test_plan
from backend.analytics.batch_predictor import run_cross_batch_analysis
from backend.config import ARDUINO_BOARD, ARDUINO_PORT, get_model_status
from backend.hardware.arduino_uploader import upload_to_arduino
from backend.hardware.serial_reader import iter_serial_data, read_serial_data
from backend.report.pdf_generator import generate_pdf_report
from backend.simulator.mock_device import MockDevice
from backend.persistence.run_store import (
    append_run_event,
    create_run_record,
    fetch_run_record,
    update_run_record,
)

app = FastAPI(title="AI Product Verification Engineer Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RequirementsPayload(BaseModel):
    """Request body for generating a test plan from requirements."""

    requirements: list[dict]
    run_id: str | None = None


class TestPlanPayload(BaseModel):
    """Request body for generating an Arduino script from a test plan."""

    test_plan: list[dict]
    run_id: str | None = None


class FlashPayload(BaseModel):
    """Request body for flashing an Arduino sketch."""

    script: str
    port: str = ARDUINO_PORT
    board: str = ARDUINO_BOARD


class HardwarePayload(BaseModel):
    """Request body for collecting hardware readings from serial."""

    port: str = ARDUINO_PORT
    expected_count: int = Field(default=16, ge=1)
    focus_gate: int | None = None
    focus_input_a: int | None = None
    focus_input_b: int | None = None
    phase: str = "initial"


class SimulationPayload(BaseModel):
    """Request body for generating simulated readings."""

    test_plan: list[dict]
    cycles: int = Field(default=1, ge=1)
    focus_gate: int | None = None
    focus_input_a: int | None = None
    focus_input_b: int | None = None
    sample_count: int | None = Field(default=None, ge=1)
    seed: int = 7400
    batch_profile: int = 0
    inject_reference_failures: bool = True
    phase: str = "initial"


class StreamExecutionPayload(BaseModel):
    """Request body for live execution streaming."""

    mode: str = Field(pattern="^(hardware|simulation)$")
    test_plan: list[dict]
    expected_count: int = Field(default=16, ge=1)
    port: str = ARDUINO_PORT
    run_id: str | None = None


class AnalysisPayload(BaseModel):
    """Request body for analysing execution results."""

    readings: list[dict]
    test_plan: list[dict]
    run_id: str | None = None


class FollowUpPayload(BaseModel):
    """Request body for autonomous follow-up execution."""

    mode: str = Field(pattern="^(hardware|simulation)$")
    test_plan: list[dict]
    follow_up_plan: list[dict]
    port: str = ARDUINO_PORT
    run_id: str | None = None


class BatchPayload(BaseModel):
    """Request body for multi-batch simulation analysis."""

    test_plan: list[dict]
    batch_count: int = Field(default=5, ge=1, le=10)
    run_id: str | None = None


class QuestionPayload(BaseModel):
    """Request body for natural-language Q&A over results."""

    question: str
    analysis: dict
    readings: list[dict]
    requirements: list[dict]
    test_plan: list[dict]
    batch_analysis: dict | None = None
    coverage_summary: dict | None = None
    decision_state: dict | None = None
    run_id: str | None = None


class ReportPayload(BaseModel):
    """Request body for generating the final PDF report."""

    analysis: dict
    requirements: list[dict]
    test_plan: list[dict]
    narrative: str | None = None
    conflicts: list[dict] = Field(default_factory=list)
    batch_analysis: dict | None = None
    follow_up_runs: list[dict] = Field(default_factory=list)
    run_id: str | None = None


def _success_response(data: dict, message: str) -> JSONResponse:
    """Build a standard success JSON response."""
    return JSONResponse({"status": "success", "data": data, "message": message})


def _error_response(message: str, status_code: int = 500) -> JSONResponse:
    """Build a standard error JSON response."""
    return JSONResponse(
        status_code=status_code,
        content={"status": "error", "data": {}, "message": message},
    )


def _stream_line(event: str, data: dict) -> str:
    """Encode a streaming event as newline-delimited JSON."""
    return json.dumps({"event": event, "data": data}) + "\n"


@app.post("/api/extract-requirements")
async def extract_requirements_route(request: Request) -> JSONResponse:
    """Extract structured requirements and detect conflicts from a PDF byte stream."""
    try:
        pdf_bytes = await request.body()
        document = extract_pdf_context(pdf_bytes)
        document_name = request.headers.get("x-document-name")
        mode = request.headers.get("x-verification-mode", "hardware")
        run_id = create_run_record(mode, document_name, document)
        requirements = extract_requirements(document["text"])
        conflicts = detect_requirement_conflicts(requirements)
        update_run_record(
            run_id,
            "requirements",
            document_name=document_name,
            document_meta=document,
            requirements=requirements,
            conflicts=conflicts,
        )
        append_run_event(
            run_id,
            "requirements",
            "requirements_extracted",
            {
                "requirements": len(requirements),
                "conflicts": len(conflicts),
                "document_name": document_name,
            },
        )
        return _success_response(
            {"requirements": requirements, "conflicts": conflicts, "document": document, "run_id": run_id},
            "Requirements extracted successfully",
        )
    except Exception as exc:
        return _error_response(str(exc))


@app.post("/api/generate-test-plan")
async def generate_test_plan_route(payload: RequirementsPayload) -> JSONResponse:
    """Generate a verification test plan from extracted requirements."""
    try:
        test_plan = generate_test_plan(payload.requirements)
        update_run_record(payload.run_id, "test_plan", test_plan=test_plan)
        append_run_event(
            payload.run_id,
            "test_plan",
            "test_plan_generated",
            {"test_cases": len(test_plan)},
        )
        return _success_response({"test_plan": test_plan, "run_id": payload.run_id}, "Test plan generated successfully")
    except Exception as exc:
        return _error_response(str(exc))


@app.post("/api/generate-script")
async def generate_script_route(payload: TestPlanPayload) -> JSONResponse:
    """Generate an Arduino sketch from a structured test plan."""
    try:
        script = generate_arduino_script(payload.test_plan)
        update_run_record(payload.run_id, "script", script=script)
        append_run_event(
            payload.run_id,
            "script",
            "script_generated",
            {"script_lines": len(script.splitlines())},
        )
        return _success_response(
            {"script": script, "script_path": str(SCRIPT_PATH), "run_id": payload.run_id},
            "Arduino script generated successfully",
        )
    except Exception as exc:
        return _error_response(str(exc))


@app.post("/api/flash-arduino")
async def flash_arduino_route(payload: FlashPayload) -> JSONResponse:
    """Persist a sketch and upload it to the configured Arduino device."""
    try:
        SCRIPT_PATH.parent.mkdir(parents=True, exist_ok=True)
        Path(SCRIPT_PATH).write_text(payload.script, encoding="utf-8")
        result = upload_to_arduino(str(SCRIPT_PATH), payload.port, payload.board)
        if result["status"] == "error":
            return _error_response(result["message"])
        return _success_response(result, "Arduino flashed successfully")
    except Exception as exc:
        return _error_response(str(exc))


@app.post("/api/run-hardware")
async def run_hardware_route(payload: HardwarePayload) -> JSONResponse:
    """Read live test data from an attached Arduino over serial."""
    try:
        readings = read_serial_data(
            payload.port,
            payload.expected_count,
            focus_gate=payload.focus_gate,
            focus_input_a=payload.focus_input_a,
            focus_input_b=payload.focus_input_b,
            phase=payload.phase,
        )
        return _success_response({"readings": readings}, "Hardware readings collected successfully")
    except Exception as exc:
        return _error_response(str(exc))


@app.post("/api/run-simulation")
async def run_simulation_route(payload: SimulationPayload) -> JSONResponse:
    """Generate simulated device readings for the provided test plan."""
    try:
        readings = MockDevice(
            seed=payload.seed,
            batch_profile=payload.batch_profile,
            inject_reference_failures=payload.inject_reference_failures,
        ).run_tests(
            payload.test_plan,
            cycles=payload.cycles,
            focus_gate=payload.focus_gate,
            focus_input_a=payload.focus_input_a,
            focus_input_b=payload.focus_input_b,
            sample_count=payload.sample_count,
            phase=payload.phase,
        )
        return _success_response({"readings": readings}, "Simulation completed successfully")
    except Exception as exc:
        return _error_response(str(exc))


@app.post("/api/stream-execution")
async def stream_execution_route(payload: StreamExecutionPayload) -> StreamingResponse:
    """Stream execution readings and anomaly events for the dashboard."""

    update_run_record(payload.run_id, "execution")
    append_run_event(
        payload.run_id,
        "execution",
        "execution_started",
        {"mode": payload.mode, "expected_count": payload.expected_count},
    )

    def event_stream():
        readings: list[dict] = []
        if payload.mode == "hardware":
            iterator = iter_serial_data(payload.port, payload.expected_count)
        else:
            iterator = iter(
                MockDevice().run_tests(
                    payload.test_plan,
                    sample_count=payload.expected_count,
                    phase="initial",
                )
            )

        anomaly_count = 0
        for reading in iterator:
            readings.append(reading)
            yield _stream_line("reading", reading)
            if reading.get("is_anomaly") or reading["result"] == "FAIL":
                anomaly_count += 1
                yield _stream_line(
                    "anomaly",
                    {
                        "test_id": reading["test_id"],
                        "message": (
                            f"{reading['phase'].title()} anomaly on Gate {reading['gate']} A={reading['input_a']} B={reading['input_b']}: "
                            f"{reading['measured_voltage']}V against {reading['spec_limit']}."
                        ),
                        "severity": "HIGH" if reading["result"] == "FAIL" else "MEDIUM",
                    },
                )
            time.sleep(0.08 if payload.mode == "simulation" else 0.02)

        append_run_event(
            payload.run_id,
            "execution",
            "execution_completed",
            {"readings": len(readings), "anomalies": anomaly_count},
        )
        yield _stream_line("complete", {"count": len(readings)})

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.post("/api/analyse-results")
async def analyse_results_route(payload: AnalysisPayload) -> JSONResponse:
    """Analyse collected readings against the test plan."""
    try:
        analysis = analyse_results(payload.readings, payload.test_plan)
        update_run_record(payload.run_id, "analysis", readings=payload.readings, analysis=analysis)
        append_run_event(
            payload.run_id,
            "analysis",
            "analysis_completed",
            {
                "overall_result": analysis.get("overall_result"),
                "failed": analysis.get("failed"),
                "passed": analysis.get("passed"),
            },
        )
        return _success_response({"analysis": analysis, "run_id": payload.run_id}, "Results analysed successfully")
    except Exception as exc:
        return _error_response(str(exc))


@app.post("/api/run-follow-up")
async def run_follow_up_route(payload: FollowUpPayload) -> JSONResponse:
    """Execute targeted follow-up runs selected by the agent."""
    try:
        runs: list[dict] = []
        for index, plan in enumerate(payload.follow_up_plan):
            sample_count = int(plan.get("sample_count", 30))
            if payload.mode == "hardware":
                readings = read_serial_data(
                    payload.port,
                    sample_count,
                    focus_gate=plan.get("gate"),
                    focus_input_a=plan.get("input_a"),
                    focus_input_b=plan.get("input_b"),
                    phase="follow_up",
                )
            else:
                readings = MockDevice(
                    seed=8400 + index,
                    batch_profile=min(index + 1, 4),
                    inject_reference_failures=False,
                ).run_tests(
                    payload.test_plan,
                    focus_gate=plan.get("gate"),
                    focus_input_a=plan.get("input_a"),
                    focus_input_b=plan.get("input_b"),
                    sample_count=sample_count,
                    phase="follow_up",
                )
            runs.append(
                {
                    "plan_id": plan.get("plan_id", f"FU-{index + 1:03d}"),
                    "mode": payload.mode,
                    "executed": True,
                    "rationale": plan.get("rationale", "Autonomous follow-up execution."),
                    "summary": (
                        f"Collected {len(readings)} focused readings for Gate {plan.get('gate')} "
                        f"A={plan.get('input_a')} B={plan.get('input_b')}."
                    ),
                    "readings": readings,
                }
            )
        update_run_record(payload.run_id, "follow_up", follow_up_runs=runs)
        append_run_event(
            payload.run_id,
            "follow_up",
            "follow_up_completed",
            {"runs": len(runs), "readings": sum(len(run["readings"]) for run in runs)},
        )
        return _success_response(
            {"runs": runs, "summary": summarize_follow_up_runs(runs), "run_id": payload.run_id},
            "Follow-up runs executed successfully",
        )
    except Exception as exc:
        return _error_response(str(exc))


@app.post("/api/run-batch-analysis")
async def run_batch_analysis_route(payload: BatchPayload) -> JSONResponse:
    """Run multi-batch simulation analysis for failure prediction."""
    try:
        batch_analysis = run_cross_batch_analysis(payload.test_plan, payload.batch_count)
        update_run_record(payload.run_id, "batch_analysis", batch_analysis=batch_analysis)
        append_run_event(
            payload.run_id,
            "batch_analysis",
            "batch_analysis_completed",
            {
                "batch_count": batch_analysis.get("batch_count"),
                "drift_detected": batch_analysis.get("drift_detected"),
            },
        )
        return _success_response({"batch_analysis": batch_analysis, "run_id": payload.run_id}, "Batch analysis completed successfully")
    except Exception as exc:
        return _error_response(str(exc))


@app.post("/api/ask-results")
async def ask_results_route(payload: QuestionPayload) -> JSONResponse:
    """Answer a natural-language question using verification evidence."""
    try:
        answer = answer_results_question(
            payload.question,
            payload.analysis,
            payload.readings,
            payload.requirements,
            payload.test_plan,
            payload.batch_analysis,
            payload.coverage_summary,
            payload.decision_state,
        )
        append_run_event(
            payload.run_id,
            "qa",
            "chat_answered",
            {
                "question": payload.question,
                "answer": answer.get("answer", ""),
                "citations": answer.get("citations", [])[:5],
            },
        )
        return _success_response({"response": answer, "run_id": payload.run_id}, "Question answered successfully")
    except Exception as exc:
        return _error_response(str(exc))


@app.post("/api/generate-report")
async def generate_report_route(payload: ReportPayload) -> Response:
    """Generate the final multi-page DVP report as a downloadable PDF."""
    try:
        narrative = payload.narrative or write_report_narrative(
            payload.analysis,
            payload.requirements,
            payload.test_plan,
        )
        pdf_bytes = generate_pdf_report(
            narrative,
            payload.analysis,
            payload.requirements,
            payload.conflicts,
            payload.batch_analysis,
            payload.follow_up_runs,
        )
        update_run_record(payload.run_id, "report", report_generated=True, report_name="dvp_report.pdf")
        append_run_event(
            payload.run_id,
            "report",
            "report_generated",
            {"filename": "dvp_report.pdf"},
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="dvp_report.pdf"'},
        )
    except Exception as exc:
        return _error_response(str(exc))


@app.get("/api/runs/{run_id}")
async def get_run_route(run_id: str) -> JSONResponse:
    """Return the persisted run record and event log when database storage is enabled."""
    record = fetch_run_record(run_id)
    if not record:
        return _error_response("Run not found", status_code=404)
    return _success_response({"run": record}, "Run record retrieved successfully")


@app.get("/api/model-status")
async def model_status_route() -> JSONResponse:
    """Return the configured model routing stack and the active provider/model."""
    return _success_response({"model": get_model_status()}, "Model status retrieved successfully")

@app.get("/api/health")
async def health_route() -> JSONResponse:
    """Return a basic health response for the FastAPI service."""
    return _success_response({"status": "ok"}, "Service healthy")













