"use client";

import { useDeferredValue } from "react";

import type { AnomalyHighlight, ReadingItem } from "../lib/api";

interface LiveReadingsProps {
  readings: ReadingItem[];
  liveBanner: string | null;
  anomalies: AnomalyHighlight[];
}

function chartPoint(index: number, total: number, value: number) {
  const x = total <= 1 ? 24 : 24 + (index / (total - 1)) * 512;
  const y = 190 - (value / 5) * 150;
  return { x, y };
}

export function LiveReadings({ readings, liveBanner, anomalies }: LiveReadingsProps) {
  const deferredReadings = useDeferredValue(readings);
  const recentReadings = deferredReadings.slice(-32);

  return (
    <section className="panel stack">
      <div className="eyebrow">Feature 3</div>
      <h2 style={{ margin: 0 }}>Live streaming dashboard</h2>
      {liveBanner ? <div className="alert-banner">{liveBanner}</div> : null}
      <div className="chart-shell">
        <div className="chart-head">
          <strong>Output voltage timeline</strong>
          <span className="muted">Real-time stream from {deferredReadings[0]?.source ?? "execution"}</span>
        </div>
        <svg className="wave-chart" viewBox="0 0 560 220" role="img" aria-label="Live output voltage chart">
          <line x1="20" y1="46" x2="540" y2="46" className="chart-threshold" />
          <line x1="20" y1="178" x2="540" y2="178" className="chart-threshold low-threshold" />
          <line x1="20" y1="190" x2="540" y2="190" className="chart-axis" />
          {recentReadings.map((reading, index) => {
            if (index === 0) {
              return null;
            }
            const previous = recentReadings[index - 1];
            const start = chartPoint(index - 1, recentReadings.length, previous.measured_voltage);
            const end = chartPoint(index, recentReadings.length, reading.measured_voltage);
            const danger = previous.is_anomaly || reading.is_anomaly;
            return (
              <line
                key={`${reading.test_id}-${reading.timestamp}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                className={danger ? "chart-line chart-line-danger" : "chart-line"}
              />
            );
          })}
          {recentReadings.map((reading, index) => {
            const point = chartPoint(index, recentReadings.length, reading.measured_voltage);
            return (
              <circle
                key={`${reading.test_id}-${reading.timestamp}-point`}
                cx={point.x}
                cy={point.y}
                r="4"
                className={reading.is_anomaly ? "chart-dot chart-dot-danger" : "chart-dot"}
              />
            );
          })}
        </svg>
        <div className="muted">Red segments indicate out-of-spec behavior. Upper dashed line is VOH min 2.4 V, lower dashed line is VOL max 0.4 V.</div>
      </div>
      <div className="alert-stack">
        {anomalies.length === 0 ? (
          <div className="muted">Anomaly alerts will appear here as soon as the stream crosses a spec limit.</div>
        ) : (
          anomalies.map((anomaly, index) => (
            <div className="alert-chip" key={`${anomaly.test_id}-${index}`}>
              <strong>{anomaly.test_id}</strong>
              <span>{anomaly.message}</span>
            </div>
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
              deferredReadings.map((reading) => (
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
