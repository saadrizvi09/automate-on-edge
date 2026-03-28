import type { AnalysisResult, SpcGroup } from "../lib/api";

interface StatisticalPanelProps {
  analysis: AnalysisResult | null;
}

function specLimitValue(specLimit: string): number | null {
  const match = specLimit.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function worstGroup(groups: SpcGroup[]): SpcGroup | null {
  return [...groups].sort((left, right) => {
    const leftScore = left.cpk ?? 999;
    const rightScore = right.cpk ?? 999;
    if (left.violations !== right.violations) {
      return right.violations - left.violations;
    }
    return leftScore - rightScore;
  })[0] ?? null;
}

export function StatisticalPanel({ analysis }: StatisticalPanelProps) {
  const groups = analysis?.spc_summary.groups ?? [];
  const highlightedGroup = worstGroup(groups);
  const maxY = Math.max(...(highlightedGroup?.bell_curve.map((point) => point.y) ?? [1]));
  const specValue = highlightedGroup ? specLimitValue(highlightedGroup.spec_limit) : null;

  return (
    <section className="panel stack">
      <div className="eyebrow">SPC engine</div>
      <h2 style={{ margin: 0 }}>Statistical process control</h2>
      {!analysis ? (
        <p className="muted">Run the verification flow to compute mean, standard deviation, and Cpk for each measured condition.</p>
      ) : (
        <>
          <div className="metric-strip">
            <div className="metric-mini">
              <div className="muted">Process capable</div>
              <strong>{analysis.spc_summary.capable ? "Yes" : "No"}</strong>
            </div>
            <div className="metric-mini">
              <div className="muted">Tracked groups</div>
              <strong>{analysis.spc_summary.groups.length}</strong>
            </div>
            <div className="metric-mini">
              <div className="muted">Worst group</div>
              <strong>{analysis.spc_summary.worst_group ?? "-"}</strong>
            </div>
          </div>
          {highlightedGroup ? (
            <div className="chart-shell">
              <div className="chart-head">
                <strong>{highlightedGroup.group_id}</strong>
                <span className={highlightedGroup.capable ? "reading-pass" : "reading-fail"}>
                  Cpk {highlightedGroup.cpk ?? "N/A"}
                </span>
              </div>
              <svg className="wave-chart" viewBox="0 0 560 220" role="img" aria-label="Bell curve chart">
                <line x1="0" y1="180" x2="560" y2="180" className="chart-axis" />
                {highlightedGroup.bell_curve.map((point, index, points) => {
                  if (index === 0) {
                    return null;
                  }
                  const previous = points[index - 1];
                  const x1 = ((index - 1) / (points.length - 1)) * 520 + 20;
                  const y1 = 180 - ((previous.y / maxY) * 140);
                  const x2 = (index / (points.length - 1)) * 520 + 20;
                  const y2 = 180 - ((point.y / maxY) * 140);
                  return <line key={`${point.x}-${index}`} x1={x1} y1={y1} x2={x2} y2={y2} className="chart-line" />;
                })}
                {specValue !== null ? (
                  <line
                    x1={20 + (((specValue - highlightedGroup.bell_curve[0].x) / (highlightedGroup.bell_curve[highlightedGroup.bell_curve.length - 1].x - highlightedGroup.bell_curve[0].x || 1)) * 520)}
                    y1="24"
                    x2={20 + (((specValue - highlightedGroup.bell_curve[0].x) / (highlightedGroup.bell_curve[highlightedGroup.bell_curve.length - 1].x - highlightedGroup.bell_curve[0].x || 1)) * 520)}
                    y2="180"
                    className="chart-threshold"
                  />
                ) : null}
              </svg>
              <div className="muted">Mean {highlightedGroup.mean_voltage.toFixed(3)} V | Std dev {highlightedGroup.std_dev.toFixed(3)} V | Spec {highlightedGroup.spec_limit}</div>
            </div>
          ) : null}
          <div className="spc-grid">
            {groups.slice(0, 6).map((group) => (
              <article className="metric-card" key={group.group_id}>
                <div className="muted">{group.group_id}</div>
                <div className="metric-value" style={{ fontSize: 24 }}>{group.cpk ?? "N/A"}</div>
                <div className="muted">mean {group.mean_voltage.toFixed(3)} V | std {group.std_dev.toFixed(3)} V</div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

