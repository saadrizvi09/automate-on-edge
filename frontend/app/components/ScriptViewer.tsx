import type { VerificationMode } from "../lib/api";

interface ScriptViewerProps {
  script: string;
  mode: VerificationMode;
  busy: boolean;
  ready: boolean;
  onApprove: () => void | Promise<void>;
}

export function ScriptViewer({ script, mode, busy, ready, onApprove }: ScriptViewerProps) {
  return (
    <section className="panel stack">
      <div className="eyebrow">Bench script</div>
      <h2 style={{ margin: 0 }}>Script review</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        The code is generated before execution. Flashing never starts until you approve it from this panel.
      </p>
      <div className="code-wrap">
        <pre>{script || "// Arduino sketch will appear here after generation."}</pre>
      </div>
      <div className="button-row">
        <button className="action-btn" disabled={!ready || busy || !script} onClick={() => onApprove()} type="button">
          {busy ? "Running verification..." : mode === "hardware" ? "Review and Flash" : "Review and Run simulation"}
        </button>
        <span className="muted">Mode selected: {mode === "hardware" ? "Hardware" : "Simulation"}</span>
      </div>
    </section>
  );
}

