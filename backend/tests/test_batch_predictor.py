"""Tests for cross-batch drift analysis."""

from backend.analytics.batch_predictor import run_cross_batch_analysis


def test_run_cross_batch_analysis_returns_drift_summary() -> None:
    """Verify multi-batch analysis returns deterministic drift metadata."""
    analysis = run_cross_batch_analysis([], batch_count=5)

    assert analysis["batch_count"] == 5
    assert len(analysis["batches"]) == 5
    assert analysis["predicted_hotspot_gate"] in {0, 1, 2, 3}
    assert isinstance(analysis["trend_summary"], str) and analysis["trend_summary"]
