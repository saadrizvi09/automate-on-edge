"use client";

import { useDeferredValue } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { AnomalyHighlight, ReadingItem } from "../lib/api";

interface LiveReadingsProps {
  readings: ReadingItem[];
  liveBanner: string | null;
  anomalies: AnomalyHighlight[];
}

function chartPoint(index: number, total: number, value: number) {
  const x = total <= 1 ? 28 : 28 + (index / Math.max(total - 1, 1)) * 504;
  const y = 188 - (value / 5) * 144;
  return { x, y };
}

function buildLinePath(readings: ReadingItem[]): string {
  return readings
    .map((reading, index) => {
      const point = chartPoint(index, readings.length, reading.measured_voltage);
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function buildAreaPath(readings: ReadingItem[]): string {
  if (readings.length === 0) {
    return "";
  }
  const line = buildLinePath(readings);
  const lastPoint = chartPoint(readings.length - 1, readings.length, readings[readings.length - 1].measured_voltage);
  const firstPoint = chartPoint(0, readings.length, readings[0].measured_voltage);
  return `${line} L${lastPoint.x.toFixed(1)},194 L${firstPoint.x.toFixed(1)},194 Z`;
}

export function LiveReadings({ readings, liveBanner, anomalies }: LiveReadingsProps) {
  const deferredReadings = useDeferredValue(readings);
  const recentReadings = deferredReadings.slice(-32);
  const linePath = buildLinePath(recentReadings);
  const areaPath = buildAreaPath(recentReadings);
  const latestReading = recentReadings[recentReadings.length - 1];

  return (
    <section className="panel stack live-panel">
      <div className="panel-headline-row">
        <div>
          <div className="eyebrow">Live telemetry</div>
          <h2 style={{ margin: 0 }}>Live telemetry dashboard</h2>
        </div>
        <span className="signal-chip">{latestReading ? `${latestReading.phase} phase` : "awaiting stream"}</span>
      </div>
      <AnimatePresence>
        {liveBanner ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`alert-banner ${anomalies.length > 0 ? "critical-banner" : "agent-banner"}`}
          >
            {liveBanner}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="chart-shell live-chart-shell">
        <div className="chart-head">
          <strong>Output voltage timeline</strong>
          <span className="muted">Upper guide 2.4 V, lower guide 0.4 V, red marks indicate spec escapes.</span>
        </div>
        <svg className="wave-chart" viewBox="0 0 560 220" role="img" aria-label="Live output voltage chart">
          <defs>
            <linearGradient id="liveArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(28,230,255,0.38)" />
              <stop offset="100%" stopColor="rgba(28,230,255,0.02)" />
            </linearGradient>
          </defs>
          <rect x="20" y="24" width="520" height="170" rx="18" className="chart-zone" />
          <line x1="20" y1="46" x2="540" y2="46" className="chart-threshold" />
          <line x1="20" y1="178" x2="540" y2="178" className="chart-threshold low-threshold" />
          <line x1="20" y1="194" x2="540" y2="194" className="chart-axis" />
          {areaPath ? <path d={areaPath} fill="url(#liveArea)" /> : null}
          {recentReadings.length > 1 ? <path d={linePath} fill="none" className="chart-line" /> : null}
          {recentReadings.map((reading, index) => {
            const point = chartPoint(index, recentReadings.length, reading.measured_voltage);
            return (
              <circle
                key={`${reading.test_id}-${reading.timestamp}-point`}
                cx={point.x}
                cy={point.y}
                className={reading.is_anomaly ? "chart-dot chart-dot-danger" : "chart-dot"}
              />
            );
          })}
        </svg>
        <div className="metric-strip">
          <div className="metric-mini">
            <div className="muted">Latest voltage</div>
            <strong>{latestReading ? `${latestReading.measured_voltage.toFixed(3)} V` : "-"}</strong>
          </div>
          <div className="metric-mini">
            <div className="muted">Samples in memory</div>
            <strong>{deferredReadings.length}</strong>
          </div>
          <div className="metric-mini">
            <div className="muted">Active source</div>
            <strong>{latestReading?.source ?? "execution"}</strong>
          </div>
        </div>
      </div>
      <div className="alert-stack">
        {anomalies.length === 0 ? (
          <div className="muted">Anomaly alerts will appear here the moment the stream crosses a spec limit.</div>
        ) : (
          anomalies.map((anomaly, index) => (
            <motion.div
              key={`${anomaly.test_id}-${index}`}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              className="alert-chip"
            >
              <strong>{anomaly.test_id}</strong>
              <span>{anomaly.message}</span>
            </motion.div>
          ))
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Test</th>
              <th>Gate</th>
              <th>Inputs</th>
              <th>Voltage</th>
              <th>Spec</th>
              <th>Phase</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {deferredReadings.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">Readings stream into the chart and table as the execution loop runs.</td>
              </tr>
            ) : (
              deferredReadings.slice(-18).reverse().map((reading) => (
                <tr key={`${reading.test_id}-${reading.timestamp}`} className={reading.is_anomaly ? "anomaly-row" : undefined}>
                  <td>{reading.test_id}</td>
                  <td>{reading.gate}</td>
                  <td>{reading.input_a}/{reading.input_b}</td>
                  <td>{reading.measured_voltage.toFixed(3)} V</td>
                  <td>{reading.spec_limit}</td>
                  <td>{reading.phase}</td>
                  <td>
                    <span className={reading.result === "PASS" ? "reading-pass" : "reading-fail"}>{reading.result}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

