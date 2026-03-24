"""PDF report generator for the final DVP deliverable."""

from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


styles = getSampleStyleSheet()


def _styled_table(rows: list[list], header_color: str, font_size: int = 8) -> Table:
    table = Table(rows, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(header_color)),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), font_size),
            ]
        )
    )
    return table


def _build_requirements_table(requirements: list) -> Table:
    rows = [["ID", "Description", "Acceptance Criteria", "Test Method"]]
    for item in requirements:
        rows.append([
            item.get("id", ""),
            item.get("description", ""),
            item.get("acceptance_criteria", ""),
            item.get("test_method", ""),
        ])
    return _styled_table(rows, "#1f4b99")


def _build_results_table(analysis: dict) -> Table:
    rows = [
        ["Overall Result", analysis.get("overall_result", "")],
        ["Total Tests", analysis.get("total_tests", 0)],
        ["Passed", analysis.get("passed", 0)],
        ["Failed", analysis.get("failed", 0)],
        ["Worst SPC Group", analysis.get("spc_summary", {}).get("worst_group", "-")],
    ]
    table = Table(rows)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#dce7f9")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return table


def _build_failures_table(analysis: dict) -> Table:
    rows = [["Test ID", "Description", "Measured", "Spec", "Severity", "Recommendation"]]
    failures = analysis.get("failures", []) or []
    if not failures:
        rows.append(["-", "No failures detected", "-", "-", "-", "No action required"])
    for item in failures:
        rows.append([
            item.get("test_id", ""),
            item.get("description", ""),
            item.get("measured", ""),
            item.get("spec", ""),
            item.get("severity", ""),
            item.get("recommendation", ""),
        ])
    return _styled_table(rows, "#7f1d1d")


def _build_spc_table(analysis: dict) -> Table:
    rows = [["Group", "Samples", "Mean", "Std Dev", "Cpk", "Capable"]]
    groups = analysis.get("spc_summary", {}).get("groups", []) or []
    if not groups:
        rows.append(["-", 0, "-", "-", "-", "-"])
    for group in groups:
        rows.append([
            group.get("group_id", ""),
            group.get("samples", 0),
            group.get("mean_voltage", ""),
            group.get("std_dev", ""),
            group.get("cpk", "N/A"),
            "YES" if group.get("capable") else "NO",
        ])
    return _styled_table(rows, "#0d3b66")


def _build_conflicts_table(conflicts: list[dict]) -> Table:
    rows = [["Conflict", "Requirement IDs", "Subject", "Severity", "Explanation"]]
    if not conflicts:
        rows.append(["-", "-", "No conflicts detected", "-", "No requirement conflicts were detected in the extracted specification set."])
    for item in conflicts:
        rows.append([
            item.get("conflict_id", ""),
            ", ".join(item.get("requirement_ids", [])),
            item.get("subject", ""),
            item.get("severity", ""),
            item.get("explanation", ""),
        ])
    return _styled_table(rows, "#8b5e34")


def _build_batch_table(batch_analysis: dict | None) -> Table:
    rows = [["Batch", "Seed", "Failures", "Failure Rate", "Hot Gate Rates"]]
    batches = (batch_analysis or {}).get("batches", []) or []
    if not batches:
        rows.append(["-", "-", "-", "-", "No batch analysis provided"])
    for item in batches:
        rows.append([
            item.get("batch_id", ""),
            item.get("seed", ""),
            item.get("failure_count", 0),
            item.get("failure_rate", 0),
            ", ".join(f"{key}:{value}" for key, value in item.get("gate_failure_rates", {}).items()),
        ])
    return _styled_table(rows, "#355070")


def _build_follow_up_table(follow_up_runs: list[dict]) -> Table:
    rows = [["Plan", "Mode", "Executed", "Samples", "Summary"]]
    if not follow_up_runs:
        rows.append(["-", "-", "No", 0, "No agentic follow-up runs were executed."])
    for item in follow_up_runs:
        rows.append([
            item.get("plan_id", ""),
            item.get("mode", ""),
            "Yes" if item.get("executed") else "No",
            len(item.get("readings", [])),
            item.get("summary", ""),
        ])
    return _styled_table(rows, "#5c415d")


def generate_pdf_report(
    narrative: str,
    analysis: dict,
    requirements: list,
    conflicts: list[dict] | None = None,
    batch_analysis: dict | None = None,
    follow_up_runs: list[dict] | None = None,
) -> bytes:
    """Generate a multi-page DVP PDF report."""
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=letter)
    story = [
        Paragraph("AI Product Verification Engineer Agent", styles["Title"]),
        Spacer(1, 24),
        Paragraph("Design Verification Plan Report", styles["Heading1"]),
        Spacer(1, 12),
        Paragraph(narrative, styles["BodyText"]),
        Spacer(1, 18),
        Paragraph(analysis.get("summary", ""), styles["BodyText"]),
        PageBreak(),
        Paragraph("Requirements Table", styles["Heading1"]),
        Spacer(1, 12),
        _build_requirements_table(requirements),
        Spacer(1, 18),
        Paragraph("Requirement Conflict Detection", styles["Heading2"]),
        Spacer(1, 12),
        _build_conflicts_table(conflicts or []),
        PageBreak(),
        Paragraph("Test Results Summary", styles["Heading1"]),
        Spacer(1, 12),
        _build_results_table(analysis),
        Spacer(1, 24),
        Paragraph("Failure Analysis", styles["Heading1"]),
        Spacer(1, 12),
        _build_failures_table(analysis),
        PageBreak(),
        Paragraph("Statistical Process Control", styles["Heading1"]),
        Spacer(1, 12),
        _build_spc_table(analysis),
        Spacer(1, 24),
        Paragraph("Agentic Follow-up", styles["Heading1"]),
        Spacer(1, 12),
        _build_follow_up_table(follow_up_runs or []),
        Spacer(1, 24),
        Paragraph("Cross-batch Failure Prediction", styles["Heading1"]),
        Spacer(1, 12),
        _build_batch_table(batch_analysis),
        Spacer(1, 12),
        Paragraph((batch_analysis or {}).get("trend_summary", "No batch trend narrative provided."), styles["BodyText"]),
        Spacer(1, 12),
        Paragraph((batch_analysis or {}).get("recommendation", ""), styles["BodyText"]),
        PageBreak(),
        Paragraph("Sign-off Section", styles["Heading1"]),
        Spacer(1, 12),
        Paragraph("Verified by: ____________________", styles["BodyText"]),
        Spacer(1, 12),
        Paragraph("Approved by: ____________________", styles["BodyText"]),
        Spacer(1, 12),
        Paragraph("Date: ____________________", styles["BodyText"]),
    ]
    document.build(story)
    return buffer.getvalue()
