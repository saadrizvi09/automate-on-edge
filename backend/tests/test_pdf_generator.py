"""Tests for the PDF generator."""

import fitz

from backend.report.pdf_generator import generate_pdf_report


def test_generate_pdf_report_returns_pdf_bytes_with_multiple_pages() -> None:
    """Verify the PDF generator returns a readable PDF with at least four pages."""
    pdf_bytes = generate_pdf_report(
        "Verification narrative text.",
        {
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
            "summary": "Summary text.",
            "spc_summary": {
                "groups": [
                    {
                        "group_id": "Gate 2 A=1 B=1",
                        "samples": 20,
                        "mean_voltage": 0.48,
                        "std_dev": 0.03,
                        "cpk": 0.8,
                        "capable": False,
                    }
                ],
                "worst_group": "Gate 2 A=1 B=1",
                "alerts": ["alert"],
                "capable": False,
            },
        },
        [
            {
                "id": "REQ-001",
                "description": "Output HIGH voltage must be greater than 2.4V",
                "acceptance_criteria": "> 2.4V",
                "test_method": "Apply HIGH inputs and measure output voltage",
            }
        ],
        [{"conflict_id": "CONFLICT-001", "requirement_ids": ["REQ-001", "REQ-002"], "subject": "output_high_voltage", "severity": "HIGH", "explanation": "conflict"}],
        {"batches": [{"batch_id": "BATCH-01", "seed": 7400, "failure_count": 2, "failure_rate": 0.125, "gate_failure_rates": {"gate_2": 0.5}}], "trend_summary": "trend", "recommendation": "reco"},
        [{"plan_id": "FU-001", "mode": "simulation", "executed": True, "readings": [{"test_id": "TC-001"}], "summary": "focused run"}],
    )

    assert pdf_bytes.startswith(b"%PDF")
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    assert document.page_count >= 4
    document.close()
