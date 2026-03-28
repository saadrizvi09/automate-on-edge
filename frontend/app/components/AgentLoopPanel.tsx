import type { AnalysisResult, FollowUpRun } from "../lib/api";

interface AgentLoopPanelProps {
  analysis: AnalysisResult | null;
  followUpRuns: FollowUpRun[];
  agentNote: string | null;
}

export function AgentLoopPanel({ analysis, followUpRuns, agentNote }: AgentLoopPanelProps) {
  return (
    <section className="panel stack">
      <div className="panel-headline-row">
        <div>
          <div className="eyebrow">Adaptive loop</div>
          <h2 style={{ margin: 0 }}>Agentic feedback loop</h2>
        </div>
        <span className="signal-chip">{analysis?.follow_up_plan.length ?? 0} planned</span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        The agent watches failures and low-Cpk conditions, pauses to explain the anomaly, then schedules focused reruns without waiting for a human.
      </p>
      {agentNote ? <div className="alert-banner agent-banner">{agentNote}</div> : null}
      {!analysis ? (
        <p className="muted">The follow-up planner activates after the first analysis pass.</p>
      ) : (
        <>
          <div className="agent-grid">
            {(analysis.follow_up_plan.length ? analysis.follow_up_plan : []).map((plan) => (
              <article key={plan.plan_id} className="analysis-card">
                <div className="badge-row" style={{ justifyContent: "space-between" }}>
                  <strong>{plan.plan_id}</strong>
                  <span className={`severity-${plan.priority.toLowerCase()}`}>{plan.priority}</span>
                </div>
                <p style={{ marginBottom: 8 }}>{plan.target_metric}</p>
                <p className="muted">Gate {plan.gate} at A={plan.input_a} B={plan.input_b}</p>
                <p className="muted">{plan.sample_count} targeted samples</p>
                <p className="muted">{plan.rationale}</p>
              </article>
            ))}
            {analysis.follow_up_plan.length === 0 ? (
              <article className="analysis-card accent-card">
                <strong>No branch selected</strong>
                <p className="muted" style={{ marginBottom: 0 }}>
                  The agent found no failing or statistically weak condition severe enough to justify a targeted rerun.
                </p>
              </article>
            ) : null}
          </div>
          <div className="agent-grid">
            {followUpRuns.map((run) => (
              <article key={run.plan_id} className="analysis-card accent-card">
                <strong>{run.plan_id}</strong>
                <p>{run.summary}</p>
                <p className="muted">{run.readings.length} additional readings captured in {run.mode} mode.</p>
                <p className="muted">{run.rationale}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

