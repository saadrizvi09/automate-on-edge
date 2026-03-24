import type { RequirementConflict } from "../lib/api";

interface ConflictPanelProps {
  conflicts: RequirementConflict[];
}

export function ConflictPanel({ conflicts }: ConflictPanelProps) {
  return (
    <section className="panel stack">
      <div className="eyebrow">Requirement guardrail</div>
      <h2 style={{ margin: 0 }}>Conflict detection</h2>
      {conflicts.length === 0 ? (
        <div className="analysis-card">
          <strong>No conflicts found.</strong>
          <p className="muted">The extracted requirements do not contain contradictory threshold statements.</p>
        </div>
      ) : (
        conflicts.map((conflict) => (
          <article className="analysis-card" key={conflict.conflict_id}>
            <div className="badge-row" style={{ justifyContent: "space-between" }}>
              <strong>{conflict.conflict_id}</strong>
              <span className={`severity-${conflict.severity.toLowerCase()}`}>{conflict.severity}</span>
            </div>
            <p style={{ marginBottom: 8 }}>{conflict.explanation}</p>
            <p className="muted" style={{ margin: 0 }}>
              Subject: {conflict.subject} | Requirements: {conflict.requirement_ids.join(", ")}
            </p>
          </article>
        ))
      )}
    </section>
  );
}
