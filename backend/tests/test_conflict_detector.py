"""Tests for requirement conflict detection."""

from backend.agents.conflict_detector import detect_requirement_conflicts


def test_detect_requirement_conflicts_finds_threshold_collisions() -> None:
    """Verify contradictory thresholds are reported."""
    conflicts = detect_requirement_conflicts(
        [
            {
                "id": "REQ-001",
                "description": "Output HIGH voltage must be greater than 2.4V",
                "acceptance_criteria": "> 2.4V",
                "test_method": "Measure output",
            },
            {
                "id": "REQ-002",
                "description": "Output HIGH voltage must be less than 2.0V",
                "acceptance_criteria": "< 2.0V",
                "test_method": "Measure output",
            },
        ]
    )

    assert len(conflicts) == 1
    assert conflicts[0]["requirement_ids"] == ["REQ-001", "REQ-002"]
