"use client";

import { motion } from "framer-motion";

import type { ConfidenceHistoryPoint, DecisionSnapshot } from "../lib/workflow-intelligence";

interface DecisionPanelProps {
  decision: DecisionSnapshot;
  history: ConfidenceHistoryPoint[];
}

function stateClass(state: DecisionSnapshot["state"]): string {
  if (state === "qualified") {
    return "decision-qualified";
  }
  if (state === "rejected") {
    return "decision-rejected";
  }
  if (state === "investigating" || state === "inconclusive") {
    return "decision-investigating";
  }
  return "decision-neutral";
}

export function DecisionPanel({ decision, history }: DecisionPanelProps) {
  const ringProgress = Math.max(0.12, decision.confidence) * 100;

  return (
    <section className="panel stack decision-panel">
      <div className="panel-headline-row">
        <div>
          <div className="eyebrow">Decision state</div>
          <h2 style={{ margin: 0 }}>{decision.label}</h2>
        </div>
        <span className={`decision-chip ${stateClass(decision.state)}`}>{decision.state}</span>
      </div>
      <div className="decision-layout">
        <motion.div
          className="decision-orb-wrap"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div
            className="decision-orb"
            style={{
              background: `conic-gradient(from 180deg, rgba(28,230,255,0.92) 0deg, rgba(28,230,255,0.92) ${ringProgress * 3.6}deg, rgba(255,255,255,0.08) ${ringProgress * 3.6}deg, rgba(255,255,255,0.08) 360deg)`,
            }}
          >
            <div className="decision-orb-core">
              <span className="decision-orb-value">{decision.confidence.toFixed(2)}</span>
              <span className="decision-orb-label">confidence</span>
            </div>
          </div>
        </motion.div>
        <div className="decision-copy">
          <p style={{ margin: 0 }}>{decision.rationale}</p>
          <div className="analysis-card accent-card">
            <strong>Next action</strong>
            <p className="muted" style={{ marginBottom: 0 }}>{decision.next_action}</p>
          </div>
          <div className="signal-chip-row">
            {decision.evidence.map((item) => (
              <span className="signal-chip" key={item}>{item}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="confidence-history-grid">
        {history.length === 0 ? (
          <div className="muted">Confidence changes will appear here as the agent gathers evidence.</div>
        ) : (
          history.map((point) => (
            <article className="confidence-card" key={point.id}>
              <div className="muted">{point.label}</div>
              <strong>{point.confidence.toFixed(2)}</strong>
              <div className="muted">{point.note}</div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
