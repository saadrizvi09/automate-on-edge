import type { BatchAnalysis } from "../lib/api";

interface BatchInsightPanelProps {
  batchAnalysis: BatchAnalysis | null;
}

export function BatchInsightPanel({ batchAnalysis }: BatchInsightPanelProps) {
  const maxRate = Math.max(...(batchAnalysis?.batches.map((batch) => batch.failure_rate) ?? [0.001]), 0.001);

  return (
    <section className="panel stack">
      <div className="eyebrow">Predictive layer</div>
      <h2 style={{ margin: 0 }}>Cross-batch failure prediction</h2>
      {!batchAnalysis ? (
        <p className="muted">Run simulation mode to compare five synthetic batches and surface drift trends.</p>
      ) : (
        <>
          <div className="analysis-card">
            <strong>{batchAnalysis.drift_detected ? "Manufacturing drift detected" : "No drift detected"}</strong>
            <p style={{ marginBottom: 8 }}>{batchAnalysis.trend_summary}</p>
            <p className="muted" style={{ margin: 0 }}>{batchAnalysis.recommendation}</p>
          </div>
          <div className="bar-stack">
            {batchAnalysis.batches.map((batch) => (
              <div key={batch.batch_id} className="bar-row">
                <div className="bar-label">{batch.batch_id}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(batch.failure_rate / maxRate) * 100}%` }} />
                </div>
                <div className="bar-value">{(batch.failure_rate * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
          <div className="metric-strip">
            <div className="metric-mini">
              <div className="muted">Hotspot gate</div>
              <strong>{batchAnalysis.predicted_hotspot_gate ?? "-"}</strong>
            </div>
            <div className="metric-mini">
              <div className="muted">Simulated batches</div>
              <strong>{batchAnalysis.batch_count}</strong>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

