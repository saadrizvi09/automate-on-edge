"use client";

import { motion } from "framer-motion";

import type { CoverageSummary } from "../lib/workflow-intelligence";

interface CoveragePanelProps {
  coverage: CoverageSummary;
}

function statusClass(status: string): string {
  if (status === "covered") {
    return "coverage-covered";
  }
  if (status === "partial") {
    return "coverage-partial";
  }
  return "coverage-untested";
}

export function CoveragePanel({ coverage }: CoveragePanelProps) {
  const coveredWidth = coverage.total === 0 ? 0 : (coverage.covered / coverage.total) * 100;
  const partialWidth = coverage.total === 0 ? 0 : (coverage.partial / coverage.total) * 100;
  const untestedWidth = coverage.total === 0 ? 0 : (coverage.untested / coverage.total) * 100;

  return (
    <section className="panel stack">
      <div className="panel-headline-row">
        <div>
          <div className="eyebrow">Coverage map</div>
          <h2 style={{ margin: 0 }}>Requirement coverage</h2>
        </div>
        <span className="signal-chip">ratio {coverage.coverage_ratio.toFixed(2)}</span>
      </div>
      <div className="coverage-meter-shell">
        <motion.div className="coverage-band coverage-band-covered" animate={{ width: `${coveredWidth}%` }} />
        <motion.div className="coverage-band coverage-band-partial" animate={{ width: `${partialWidth}%` }} />
        <motion.div className="coverage-band coverage-band-untested" animate={{ width: `${untestedWidth}%` }} />
      </div>
      <div className="metric-strip">
        <div className="metric-mini">
          <div className="muted">Covered</div>
          <strong>{coverage.covered}</strong>
        </div>
        <div className="metric-mini">
          <div className="muted">Partial</div>
          <strong>{coverage.partial}</strong>
        </div>
        <div className="metric-mini">
          <div className="muted">Untested</div>
          <strong>{coverage.untested}</strong>
        </div>
      </div>
      <div className="coverage-list">
        {coverage.items.length === 0 ? (
          <div className="muted">Requirement coverage appears once extraction has completed.</div>
        ) : (
          coverage.items.slice(0, 6).map((item) => (
            <article className="coverage-card" key={item.id}>
              <div className="badge-row" style={{ justifyContent: "space-between" }}>
                <strong>{item.id}</strong>
                <span className={`coverage-pill ${statusClass(item.status)}`}>{item.status}</span>
              </div>
              <p style={{ margin: "6px 0 8px" }}>{item.description}</p>
              <p className="muted" style={{ margin: 0 }}>{item.note}</p>
              <div className="coverage-meta">
                <span>{item.linked_tests} linked test{item.linked_tests === 1 ? "" : "s"}</span>
                <span>{item.linked_readings} reading{item.linked_readings === 1 ? "" : "s"}</span>
              </div>
            </article>
          ))
        )}
      </div>
      {coverage.gaps.length > 0 ? (
        <div className="analysis-card">
          <strong>Coverage gaps</strong>
          <div className="signal-list">
            {coverage.gaps.map((gap) => (
              <span key={gap} className="muted">{gap}</span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
