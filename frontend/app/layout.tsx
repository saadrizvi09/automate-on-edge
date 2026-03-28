import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SmoothScroll } from "./components/SmoothScroll";

export const metadata: Metadata = {
  title: "AI Product Verification Engineer Agent",
  description: "Datasheet-to-DVP verification workflow for hardware and simulation modes.",
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap');

  :root {
    --bg-deep: #010101;
    --bg-page: #050505;
    --bg-elevated: #0a0a0a;
    --panel-bg: rgba(8, 8, 8, 0.9);
    --panel-bg-hover: rgba(12, 12, 12, 0.94);
    --border-subtle: rgba(255, 255, 255, 0.08);
    --border-medium: rgba(255, 255, 255, 0.16);
    --border-strong: rgba(255, 255, 255, 0.26);
    --text-primary: #f5f7fa;
    --text-secondary: rgba(245, 247, 250, 0.72);
    --text-muted: rgba(245, 247, 250, 0.5);
    --accent-cyan: #7cf5ff;
    --accent-cyan-strong: #1ce6ff;
    --accent-blue: #7cf5ff;
    --accent-glow: rgba(124, 245, 255, 0.24);
    --cyan: #7cf5ff;
    --cyan-dim: rgba(124, 245, 255, 0.16);
    --paper: #f5f7fa;
    --ink: #050505;
    --line: rgba(255, 255, 255, 0.14);
    --danger: #ff637d;
    --success: #f5f7fa;
    --warning: #7cf5ff;
    --shadow-soft: 0 24px 80px rgba(0, 0, 0, 0.55);
  }

  * {
    box-sizing: border-box;
  }

  html {
    background: var(--bg-deep);
  }

  body {
    margin: 0;
    min-height: 100vh;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background:
      radial-gradient(circle at 18% 16%, rgba(124, 245, 255, 0.14), transparent 22%),
      radial-gradient(circle at 82% 12%, rgba(255, 255, 255, 0.05), transparent 16%),
      radial-gradient(circle at 74% 72%, rgba(124, 245, 255, 0.08), transparent 24%),
      linear-gradient(180deg, #010101 0%, #040404 42%, #020202 100%);
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  body::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(135deg, rgba(255,255,255,0.02), transparent 24%),
      linear-gradient(315deg, rgba(255,255,255,0.015), transparent 28%);
    mix-blend-mode: screen;
    opacity: 0.6;
  }

  a {
    color: inherit;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  .page-shell {
    min-height: 100vh;
    padding: 40px 24px 88px;
  }

  .page-grid {
    max-width: 1360px;
    margin: 0 auto;
    display: grid;
    gap: 28px;
  }

  .section-block {
    display: grid;
    gap: 18px;
  }

  .section-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }

  .control-grid {
    display: grid;
    gap: 24px;
    align-items: start;
  }

  .workspace-shell {
    display: grid;
    gap: 24px;
  }

  .panel {
    position: relative;
    overflow: hidden;
    background: linear-gradient(180deg, rgba(10,10,10,0.95), rgba(5,5,5,0.92));
    border: 1px solid var(--border-subtle);
    border-radius: 28px;
    padding: 30px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), var(--shadow-soft);
    backdrop-filter: blur(18px);
    transition: transform 240ms ease, border-color 240ms ease, background 240ms ease, box-shadow 240ms ease;
  }

  .panel::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(145deg, rgba(255,255,255,0.03), transparent 26%);
  }

  .panel:hover {
    border-color: rgba(124, 245, 255, 0.2);
    background: linear-gradient(180deg, rgba(12,12,12,0.96), rgba(6,6,6,0.94));
  }

  .panel-dark {
    background:
      radial-gradient(circle at 82% 18%, rgba(124, 245, 255, 0.18), transparent 24%),
      linear-gradient(180deg, rgba(10,10,10,0.98), rgba(3,3,3,0.96));
    border-color: rgba(255, 255, 255, 0.08);
  }

  .panel-dark::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(120deg, transparent 44%, rgba(124,245,255,0.06) 100%);
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 11px;
    font-weight: 700;
    color: var(--accent-cyan);
    margin-bottom: 12px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .eyebrow::before {
    content: "";
    display: block;
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--accent-cyan);
    box-shadow: 0 0 18px rgba(124, 245, 255, 0.7);
  }

  .headline {
    margin: 10px 0 16px;
    font-size: clamp(38px, 5.5vw, 72px);
    line-height: 0.95;
    font-weight: 700;
    letter-spacing: -0.06em;
    background: linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(124,245,255,0.92) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subhead {
    max-width: 720px;
    margin: 0;
    font-size: 17px;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  .hero {
    display: grid;
    gap: 24px;
  }

  .stats-grid,
  .content-grid,
  .footer-grid,
  .spc-grid,
  .agent-grid,
  .metric-strip {
    display: grid;
    gap: 18px;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .compact-grid {
    gap: 16px;
  }

  .content-grid,
  .footer-grid {
    grid-template-columns: 1fr;
  }

  .spc-grid,
  .agent-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .metric-strip {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }

  .metric-card,
  .metric-mini {
    border-radius: 20px;
    padding: 22px;
    background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
  }

  .metric-card:hover,
  .metric-mini:hover {
    border-color: rgba(124, 245, 255, 0.18);
  }

  .metric-value {
    margin: 8px 0 4px;
    font-size: 40px;
    font-weight: 700;
    letter-spacing: -0.05em;
    color: var(--text-primary);
  }

  .stack {
    display: grid;
    gap: 20px;
  }

  .toolbar,
  .mode-row,
  .button-row,
  .report-row,
  .badge-row,
  .chat-row,
  .citation-strip {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    align-items: center;
  }

  .mode-pill,
  .action-btn,
  .download-btn,
  .chat-input {
    border: 1px solid var(--border-medium);
    border-radius: 16px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.01em;
    transition: transform 220ms ease, border-color 220ms ease, background 220ms ease, box-shadow 220ms ease, color 220ms ease;
  }

  .mode-pill {
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .mode-pill:hover:not(.active) {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-primary);
    border-color: rgba(255,255,255,0.18);
  }

  .mode-pill.active {
    background: linear-gradient(135deg, rgba(145,248,255,0.98), rgba(28,230,255,0.96));
    color: #030303;
    border-color: transparent;
    box-shadow: 0 12px 30px rgba(28, 230, 255, 0.18);
  }

  .action-btn,
  .download-btn {
    background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(124,245,255,0.96));
    color: #020202;
    border: none;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 14px 30px rgba(124,245,255,0.14);
  }

  .action-btn:hover:not(:disabled),
  .download-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 36px rgba(124,245,255,0.18);
  }

  .action-btn:disabled {
    background: rgba(255,255,255,0.06);
    color: rgba(245,247,250,0.45);
    pointer-events: none;
    box-shadow: none;
  }

  .ghost-btn {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-subtle);
  }

  .file-input,
  .chat-input {
    width: 100%;
    background: rgba(255,255,255,0.025);
    color: var(--text-primary);
    border: 1px solid var(--line);
  }

  .file-input {
    border: 1px dashed rgba(124,245,255,0.46);
    border-radius: 20px;
    padding: 24px;
    cursor: pointer;
    background: linear-gradient(180deg, rgba(124,245,255,0.08), rgba(255,255,255,0.02));
  }

  .file-input:hover {
    border-color: rgba(124,245,255,0.82);
  }

  .chat-input {
    min-width: 280px;
    outline: none;
  }

  .chat-input:focus {
    border-color: rgba(124,245,255,0.48);
    box-shadow: 0 0 0 4px rgba(124,245,255,0.08);
  }

  .progress-grid {
    position: relative;
    z-index: 1;
  }

  .progress-card {
    appearance: none;
    background: linear-gradient(180deg, rgba(5,5,5,0.98), rgba(1,1,1,0.98));
    border: 1px solid var(--line);
  }

  .progress-card:hover {
    border-color: rgba(124,245,255,0.24);
  }

  .progress-card.active,
  .progress-card.complete {
    border-color: rgba(124,245,255,0.24);
  }

  .progress-index {
    font-weight: 700;
    color: var(--text-primary);
  }

  .workflow-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    background: rgba(255,255,255,0.04);
    color: var(--text-secondary);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .workflow-summary {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.7;
    max-width: 760px;
  }

  .workflow-log {
    display: grid;
    gap: 12px;
  }

  .workflow-log-item {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 14px;
    align-items: start;
    padding: 14px 16px;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
    border: 1px solid rgba(255,255,255,0.06);
    color: rgba(245,247,250,0.9);
    line-height: 1.6;
  }

  .workflow-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 42px;
    min-height: 42px;
    padding: 0 10px;
    border-radius: 14px;
    background: rgba(124,245,255,0.12);
    border: 1px solid rgba(124,245,255,0.2);
    color: var(--accent-cyan);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
  }

  .table-wrap,
  .code-wrap {
    overflow: auto;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.015);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 640px;
  }

  th,
  td {
    padding: 16px 18px;
    text-align: left;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-size: 14px;
    vertical-align: top;
  }

  th {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 700;
    color: var(--text-muted);
    background: rgba(255,255,255,0.02);
  }

  tr:hover td {
    background: rgba(255,255,255,0.02);
  }

  pre {
    margin: 0;
    padding: 24px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 13px;
    line-height: 1.7;
    background: rgba(0,0,0,0.52);
    color: var(--text-primary);
  }

  .reading-pass,
  .reading-fail,
  .severity-high,
  .severity-medium,
  .severity-low {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .reading-pass {
    background: rgba(255,255,255,0.06);
    color: var(--text-primary);
    border: 1px solid rgba(255,255,255,0.1);
  }

  .reading-fail,
  .severity-high {
    background: rgba(255,99,125,0.12);
    color: #ff9dac;
    border: 1px solid rgba(255,99,125,0.24);
    box-shadow: 0 0 16px rgba(255,99,125,0.1);
  }

  .severity-medium {
    background: rgba(124,245,255,0.1);
    color: var(--accent-cyan);
    border: 1px solid rgba(124,245,255,0.22);
  }

  .severity-low {
    background: rgba(255,255,255,0.04);
    color: var(--text-secondary);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .analysis-card,
  .accent-card {
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 22px;
    background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
  }

  .accent-card {
    background: linear-gradient(180deg, rgba(124,245,255,0.09), rgba(255,255,255,0.02));
    border-color: rgba(124,245,255,0.16);
  }

  .muted {
    color: var(--text-secondary);
    line-height: 1.65;
  }

  .alert-banner {
    border-radius: 18px;
    padding: 16px 18px;
    background: linear-gradient(180deg, rgba(124,245,255,0.12), rgba(255,255,255,0.02));
    color: var(--text-primary);
    border: 1px solid rgba(124,245,255,0.16);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
  }

  .agent-banner {
    border-left: 2px solid rgba(124,245,255,0.5);
  }

  .alert-stack,
  .bar-stack,
  .chat-thread {
    display: grid;
    gap: 14px;
  }

  .alert-chip {
    display: grid;
    gap: 6px;
    border-radius: 16px;
    padding: 16px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-left: 2px solid rgba(124,245,255,0.42);
  }

  .chart-shell {
    border-radius: 22px;
    border: 1px solid rgba(255,255,255,0.08);
    padding: 22px;
    background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
  }

  .chart-head,
  .bar-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 16px;
    align-items: center;
  }

  .wave-chart {
    width: 100%;
    height: auto;
    display: block;
  }

  .chart-axis {
    stroke: rgba(255,255,255,0.16);
    stroke-width: 1;
  }

  .chart-threshold {
    stroke: rgba(255,255,255,0.34);
    stroke-width: 1;
    stroke-dasharray: 4 5;
  }

  .low-threshold {
    stroke: rgba(255,255,255,0.18);
  }

  .chart-line {
    stroke: var(--accent-cyan);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 8px rgba(124,245,255,0.35));
  }

  .chart-line-danger {
    stroke: var(--danger);
    filter: drop-shadow(0 0 8px rgba(255,99,125,0.28));
  }

  .chart-dot {
    fill: var(--bg-deep);
    stroke: var(--accent-cyan);
    stroke-width: 2;
    r: 4;
  }

  .chart-dot-danger {
    stroke: var(--danger);
    fill: var(--bg-deep);
    r: 5;
  }

  .anomaly-row {
    background: rgba(255,99,125,0.08) !important;
  }

  .bar-label,
  .bar-value {
    font-size: 14px;
    font-weight: 500;
  }

  .bar-track {
    height: 8px;
    border-radius: 999px;
    background: rgba(255,255,255,0.05);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(255,255,255,0.95), rgba(124,245,255,0.96));
    box-shadow: 0 0 14px rgba(124,245,255,0.35);
  }

  .chat-thread {
    max-height: 500px;
    overflow-y: auto;
    padding-right: 6px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.18) transparent;
  }

  .chat-bubble {
    border-radius: 18px;
    padding: 16px 18px;
    max-width: 88%;
    line-height: 1.7;
    font-size: 15px;
  }

  .assistant-bubble {
    border: 1px solid rgba(124,245,255,0.18);
    border-top-left-radius: 6px;
    background: linear-gradient(180deg, rgba(124,245,255,0.09), rgba(255,255,255,0.02));
  }

  .user-bubble {
    justify-self: end;
    border: 1px solid rgba(255,255,255,0.08);
    border-top-right-radius: 6px;
    background: rgba(255,255,255,0.04);
    color: var(--text-primary);
  }

  .citation-pill {
    display: inline-flex;
    border-radius: 999px;
    padding: 4px 10px;
    background: rgba(124,245,255,0.1);
    color: var(--accent-cyan);
    font-size: 12px;
    font-weight: 500;
    border: 1px solid rgba(124,245,255,0.18);
    margin-top: 8px;
  }


  .gradient-text {
    background: linear-gradient(135deg, rgba(255,255,255,1), rgba(124,245,255,0.78));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .panel-headline-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }

  .panel-aside {
    max-width: 420px;
    margin: 0;
  }

  .hero-card,
  .hero-side-panel,
  .upload-panel,
  .timeline-panel,
  .decision-panel,
  .live-panel {
    isolation: isolate;
  }

  .hero-aurora {
    position: absolute;
    border-radius: 999px;
    filter: blur(48px);
    pointer-events: none;
    z-index: -1;
  }

  .hero-aurora-left {
    width: 320px;
    height: 320px;
    left: -60px;
    top: -72px;
    background: radial-gradient(circle, rgba(124,245,255,0.2) 0%, transparent 70%);
  }

  .hero-aurora-right {
    width: 400px;
    height: 400px;
    right: -110px;
    bottom: -140px;
    background: radial-gradient(circle, rgba(124,245,255,0.14) 0%, transparent 72%);
  }

  .hero-signal-row,
  .signal-chip-row,
  .signal-list,
  .citation-stack,
  .token-totals,
  .dashboard-mosaic,
  .decision-layout,
  .confidence-history-grid,
  .coverage-list,
  .token-phase-grid,
  .timeline-feed {
    display: grid;
    gap: 16px;
  }

  .hero-signal-row,
  .signal-chip-row,
  .signal-list,
  .token-totals,
  .dashboard-mosaic,
  .decision-layout,
  .confidence-history-grid,
  .coverage-list,
  .token-phase-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .signal-chip,
  .ghost-chip,
  .decision-chip,
  .coverage-pill,
  .timeline-stage {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    color: var(--text-secondary);
  }

  .signal-chip {
    background: rgba(124,245,255,0.1);
    color: var(--accent-cyan);
    border-color: rgba(124,245,255,0.18);
  }

  .ghost-chip {
    cursor: pointer;
    background: rgba(255,255,255,0.02);
    color: var(--text-primary);
    transition: border-color 220ms ease, transform 220ms ease, background 220ms ease;
  }

  .ghost-chip:hover {
    transform: translateY(-2px);
    border-color: rgba(124,245,255,0.24);
    background: rgba(124,245,255,0.08);
  }

  .metric-card-glow {
    background: linear-gradient(180deg, rgba(124,245,255,0.06), rgba(255,255,255,0.02));
  }

  .metric-value-tight {
    font-size: clamp(24px, 3vw, 36px);
    line-height: 1.05;
  }

  .dashboard-mosaic {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }

  .decision-layout {
    grid-template-columns: minmax(180px, 240px) 1fr;
    align-items: center;
  }

  .decision-orb-wrap {
    display: flex;
    justify-content: center;
  }

  .decision-orb {
    width: 188px;
    height: 188px;
    border-radius: 999px;
    padding: 14px;
    box-shadow: 0 0 42px rgba(28,230,255,0.12);
    position: relative;
  }

  .decision-orb::before {
    content: "";
    position: absolute;
    inset: 12px;
    border-radius: inherit;
    border: 1px solid rgba(255,255,255,0.06);
  }

  .decision-orb-core {
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background: radial-gradient(circle at 28% 20%, rgba(124,245,255,0.22), rgba(8,8,8,0.96) 65%);
    border: 1px solid rgba(255,255,255,0.08);
    display: grid;
    place-items: center;
    align-content: center;
    gap: 4px;
  }

  .decision-orb-value {
    font-size: 42px;
    font-weight: 700;
    letter-spacing: -0.06em;
  }

  .decision-orb-label {
    color: var(--text-secondary);
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .decision-copy {
    display: grid;
    gap: 16px;
  }

  .confidence-history-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }

  .confidence-card,
  .coverage-card,
  .token-phase-card,
  .citation-card {
    padding: 18px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.08);
    background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
  }

  .decision-chip {
    color: var(--text-primary);
  }

  .decision-qualified {
    background: rgba(124,245,255,0.12);
    color: var(--accent-cyan);
    border-color: rgba(124,245,255,0.22);
  }

  .decision-rejected {
    background: rgba(255,99,125,0.14);
    color: #ff9dac;
    border-color: rgba(255,99,125,0.24);
  }

  .decision-investigating {
    background: rgba(124,245,255,0.09);
    color: var(--accent-cyan);
    border-color: rgba(124,245,255,0.16);
  }

  .decision-neutral {
    background: rgba(255,255,255,0.04);
    color: var(--text-secondary);
  }

  .coverage-meter-shell {
    display: flex;
    gap: 10px;
    min-height: 16px;
  }

  .coverage-band {
    height: 16px;
    border-radius: 999px;
    min-width: 0;
  }

  .coverage-band-covered {
    background: linear-gradient(90deg, rgba(28,230,255,0.95), rgba(124,245,255,0.95));
    box-shadow: 0 0 20px rgba(28,230,255,0.18);
  }

  .coverage-band-partial {
    background: linear-gradient(90deg, rgba(255,255,255,0.78), rgba(124,245,255,0.42));
  }

  .coverage-band-untested {
    background: rgba(255,255,255,0.08);
  }

  .coverage-meta,
  .token-meta-row,
  .timeline-meta-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .coverage-covered {
    background: rgba(124,245,255,0.12);
    color: var(--accent-cyan);
    border-color: rgba(124,245,255,0.22);
  }

  .coverage-partial {
    background: rgba(255,255,255,0.08);
    color: var(--text-primary);
    border-color: rgba(255,255,255,0.16);
  }

  .coverage-untested {
    background: rgba(255,99,125,0.12);
    color: #ff9dac;
    border-color: rgba(255,99,125,0.2);
  }

  .token-bar-track {
    height: 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.06);
    overflow: hidden;
  }

  .token-bar-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, rgba(255,255,255,0.95), rgba(124,245,255,0.96));
    box-shadow: 0 0 20px rgba(124,245,255,0.18);
  }

  .timeline-feed {
    gap: 0;
  }

  .timeline-item {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 18px;
  }

  .timeline-rail {
    display: grid;
    justify-items: center;
    grid-template-rows: auto 1fr;
  }

  .timeline-dot {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: var(--accent-cyan);
    box-shadow: 0 0 18px rgba(124,245,255,0.45);
    margin-top: 10px;
  }

  .timeline-line {
    width: 1px;
    min-height: 56px;
    background: linear-gradient(180deg, rgba(124,245,255,0.32), transparent);
    margin-top: 12px;
  }

  .timeline-item:last-child .timeline-line {
    visibility: hidden;
  }

  .timeline-card {
    padding: 18px 20px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.08);
    background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
    margin-bottom: 14px;
  }

  .timeline-time {
    font-size: 12px;
    color: var(--text-muted);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .timeline-headline {
    display: block;
    margin: 8px 0 6px;
    font-size: 16px;
  }

  .tone-danger .timeline-dot {
    background: var(--danger);
    box-shadow: 0 0 16px rgba(255,99,125,0.35);
  }

  .tone-danger .timeline-card {
    border-color: rgba(255,99,125,0.18);
    background: linear-gradient(180deg, rgba(255,99,125,0.08), rgba(255,255,255,0.015));
  }

  .tone-success .timeline-card,
  .tone-accent .timeline-card {
    border-color: rgba(124,245,255,0.16);
  }

  .chart-zone {
    fill: rgba(255,255,255,0.02);
    stroke: rgba(255,255,255,0.06);
  }

  .critical-banner {
    border-color: rgba(255,99,125,0.24);
    background: linear-gradient(180deg, rgba(255,99,125,0.12), rgba(255,255,255,0.02));
  }

  .citation-stack {
    margin-top: 12px;
  }

  .citation-card {
    display: grid;
    gap: 8px;
  }
  @media (min-width: 1120px) {
    .hero {
      grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr);
      align-items: stretch;
    }

    .control-grid {
      grid-template-columns: minmax(340px, 0.86fr) minmax(0, 1.14fr);
    }

    .content-grid,
    .footer-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 1080px) {
    .chart-head,
    .bar-row {
      grid-template-columns: 1fr;
      justify-items: start;
    }
  }


  @media (max-width: 980px) {
    .decision-layout {
      grid-template-columns: 1fr;
    }

    .panel-aside {
      max-width: none;
    }

    .section-heading {
      gap: 12px;
    }
  }

  @media (max-width: 760px) {
    .page-shell {
      padding: 24px 16px 56px;
    }

    .panel {
      padding: 22px;
      border-radius: 22px;
    }

    .headline {
      font-size: clamp(34px, 14vw, 52px);
    }

    .workflow-log-item {
      grid-template-columns: 1fr;
    }

    .chat-bubble {
      max-width: 100%;
    }
  }
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SmoothScroll>{children}</SmoothScroll>
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </body>
    </html>
  );
}




