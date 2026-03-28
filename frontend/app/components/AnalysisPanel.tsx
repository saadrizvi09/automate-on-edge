import type { AnalysisResult } from "../lib/api";

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
}

export function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  return (
    <section className="panel stack">
      <div className="eyebrow">Failure review</div>
      <h2 style={{ margin: 0 }}>Failure analysis</h2>
      {!analysis ? (
        <p className="muted">No analysis available yet.</p>
      ) : (
        <>
          <div className="badge-row">
            <span className={analysis.overall_result === "PASS" ? "reading-pass" : "reading-fail"}>{analysis.overall_result}</span>
            <span className="muted">{analysis.passed} passed</span>
            <span className="muted">{analysis.failed} failed</span>
            <span className="muted">{analysis.follow_up_plan.length} follow-up plans</span>
          </div>
          <p style={{ marginTop: 0 }}>{analysis.summary}</p>
          {analysis.failures.length === 0 ? (
            <div className="analysis-card">No failure cards generated because every reading passed.</div>
          ) : (
            analysis.failures.map((failure) => (
              <article className="analysis-card" key={failure.test_id}>
                <div className="badge-row" style={{ justifyContent: "space-between" }}>
                  <strong>{failure.test_id}</strong>
                  <span className={`severity-${failure.severity.toLowerCase()}`}>{failure.severity}</span>
                </div>
                <p>{failure.description}</p>
                <p className="muted">Measured: {failure.measured} | Spec: {failure.spec}</p>
                <p className="muted">Root cause: {failure.root_cause}</p>
                <p className="muted">Recommendation: {failure.recommendation}</p>
              </article>
            ))
          )}
          {analysis.anomaly_highlights.length ? (
            <div className="alert-stack">
              {analysis.anomaly_highlights.map((highlight, index) => (
                <div className="alert-chip" key={`${highlight.test_id}-${index}`}>
                  <strong>{highlight.test_id}</strong>
                  <span>{highlight.message}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

