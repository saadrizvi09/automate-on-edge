"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface StepItem {
  title: string;
  detail: string;
}

export interface StepInsight {
  summary: string;
  items: string[];
}

interface PipelineProgressProps {
  steps: StepItem[];
  stepInsights: StepInsight[];
  activeIndex: number;
  readyForReview: boolean;
  workflowComplete: boolean;
}

function stepStatus(index: number, activeIndex: number, readyForReview: boolean, workflowComplete: boolean): string {
  if (workflowComplete && index <= activeIndex) {
    return "COMPLETE";
  }
  if (readyForReview && index === activeIndex) {
    return "REVIEW";
  }
  if (index < activeIndex) {
    return "COMPLETE";
  }
  if (index === activeIndex) {
    return "RUNNING";
  }
  return "QUEUED";
}

function stepFill(index: number, activeIndex: number, readyForReview: boolean, workflowComplete: boolean, activeFill: number): number {
  if (workflowComplete && index <= activeIndex) {
    return 100;
  }
  if (readyForReview && index === activeIndex) {
    return 100;
  }
  if (index < activeIndex) {
    return 100;
  }
  if (index === activeIndex) {
    return activeFill;
  }
  return 0;
}

export function PipelineProgress({
  steps,
  stepInsights,
  activeIndex,
  readyForReview,
  workflowComplete,
}: PipelineProgressProps) {
  const [activeFill, setActiveFill] = useState(14);
  const [selectedIndex, setSelectedIndex] = useState(activeIndex >= 0 ? activeIndex : 0);

  useEffect(() => {
    setActiveFill(14);
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex >= 0) {
      setSelectedIndex(activeIndex);
    }
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex < 0 || readyForReview || workflowComplete) {
      return;
    }

    const timer = setInterval(() => {
      setActiveFill((previous) => Math.min(96, previous + (100 - previous) * 0.18));
    }, 900);

    return () => clearInterval(timer);
  }, [activeIndex, readyForReview, workflowComplete]);

  const selectedStep = steps[selectedIndex] ?? steps[0];
  const selectedInsight = stepInsights[selectedIndex] ?? { summary: selectedStep?.detail ?? "", items: [] };
  const selectedStatus = stepStatus(selectedIndex, activeIndex, readyForReview, workflowComplete);

  return (
    <section className="panel stack" style={{ overflow: "hidden", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "end", flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Agentic workflow</div>
          <h2 style={{ margin: 0 }}>Pipeline state</h2>
        </div>
        <div className="muted" style={{ maxWidth: "420px" }}>
          Select any stage to inspect what the agent completed, what evidence was captured, and what happens next.
        </div>
      </div>

      <div
        className="progress-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "18px",
        }}
      >
        {steps.map((step, index) => {
          const status = stepStatus(index, activeIndex, readyForReview, workflowComplete);
          const fillPercent = stepFill(index, activeIndex, readyForReview, workflowComplete, activeFill);
          const isSelected = index === selectedIndex;
          const isActive = status === "RUNNING";
          const isComplete = status === "COMPLETE";
          const isReview = status === "REVIEW";

          return (
            <motion.button
              type="button"
              key={step.title}
              onClick={() => setSelectedIndex(index)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.42 }}
              whileHover={{ y: -4 }}
              className={`progress-card ${isComplete ? "complete" : ""} ${isActive ? "active" : ""}`}
              style={{
                position: "relative",
                minHeight: "214px",
                borderRadius: "22px",
                padding: "18px",
                overflow: "hidden",
                textAlign: "left",
                cursor: "pointer",
                borderColor: isSelected ? "rgba(124, 245, 255, 0.58)" : isComplete || isReview ? "rgba(124, 245, 255, 0.28)" : "var(--border-subtle)",
                boxShadow: isSelected
                  ? "0 20px 48px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(124, 245, 255, 0.18)"
                  : isActive
                    ? "0 16px 40px rgba(0, 0, 0, 0.34), 0 0 30px rgba(124, 245, 255, 0.12)"
                    : "0 14px 32px rgba(0, 0, 0, 0.28)",
              }}
            >
              <motion.div
                initial={false}
                animate={{ height: `${fillPercent}%` }}
                transition={{ duration: 0.85, ease: "easeInOut" }}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 0,
                  background: "linear-gradient(180deg, rgba(140, 249, 255, 0.88) 0%, rgba(28, 230, 255, 0.98) 100%)",
                  boxShadow: "inset 0 0 32px rgba(255, 255, 255, 0.12), 0 0 42px rgba(28, 230, 255, 0.22)",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 1,
                  background: isSelected ? "linear-gradient(180deg, rgba(255,255,255,0.02), transparent)" : "transparent",
                }}
              />

              <div style={{ position: "relative", zIndex: 2, display: "grid", gap: "18px", height: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div
                    className="progress-index"
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "16px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0, 0, 0, 0.78)",
                      color: "var(--text-primary)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      fontSize: "14px",
                      letterSpacing: "0.18em",
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <span
                    className="workflow-status"
                    style={{
                      background: "rgba(0, 0, 0, 0.78)",
                      color: isActive || isReview || isComplete ? "var(--accent-cyan)" : "var(--text-secondary)",
                      border: `1px solid ${isActive || isReview || isComplete ? "rgba(124, 245, 255, 0.24)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {status}
                  </span>
                </div>

                <div style={{ display: "grid", gap: "12px", alignContent: "end", marginTop: "auto" }}>
                  <strong
                    style={{
                      fontSize: "17px",
                      lineHeight: 1.15,
                      letterSpacing: "-0.01em",
                      color: "var(--text-primary)",
                    }}
                  >
                    {step.title}
                  </strong>
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "16px",
                      background: "linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.42))",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(247, 249, 250, 0.92)",
                      fontSize: "13px",
                      lineHeight: 1.55,
                      textShadow: "0 1px 10px rgba(0, 0, 0, 0.45)",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    {step.detail}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={`${selectedIndex}-${selectedStatus}-${selectedInsight.summary}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="analysis-card"
          style={{
            borderRadius: "24px",
            background: "linear-gradient(180deg, rgba(10,10,10,0.96), rgba(4,4,4,0.96))",
            borderColor: "rgba(255,255,255,0.08)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.32)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: "8px", maxWidth: "760px" }}>
              <div className="eyebrow" style={{ marginBottom: 0 }}>Selected stage</div>
              <h3 style={{ margin: 0, fontSize: "28px", letterSpacing: "-0.03em" }}>{selectedStep.title}</h3>
              <p className="workflow-summary">{selectedInsight.summary || selectedStep.detail}</p>
            </div>
            <span className="workflow-status">{selectedStatus}</span>
          </div>

          <div className="workflow-log" style={{ marginTop: "22px" }}>
            {(selectedInsight.items.length ? selectedInsight.items : ["No work recorded for this stage yet."]).map((item, itemIndex) => (
              <div className="workflow-log-item" key={`${selectedStep.title}-${itemIndex}`}>
                <span className="workflow-badge">{String(itemIndex + 1).padStart(2, "0")}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </AnimatePresence>
    </section>
  );
}
