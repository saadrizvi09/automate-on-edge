
"use client";

import { startTransition, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { AgentLoopPanel } from "./AgentLoopPanel";
import { AgentTimelinePanel } from "./AgentTimelinePanel";
import { AnalysisPanel } from "./AnalysisPanel";
import { BatchInsightPanel } from "./BatchInsightPanel";
import { ConflictPanel } from "./ConflictPanel";
import { CoveragePanel } from "./CoveragePanel";
import { DecisionPanel } from "./DecisionPanel";
import { LiveReadings } from "./LiveReadings";
import { PipelineProgress, type StepInsight } from "./PipelineProgress";
import { ReportDownload } from "./ReportDownload";
import { RequirementsTable } from "./RequirementsTable";
import { ResultsChatPanel } from "./ResultsChatPanel";
import { ScriptViewer } from "./ScriptViewer";
import { StatisticalPanel } from "./StatisticalPanel";
import { TestPlanTable } from "./TestPlanTable";
import type {
  AnalysisResult,
  AnomalyHighlight,
  BatchAnalysis,
  ChatCitation,
  ExtractionDocument,
  ModelStatus,
  FollowUpRun,
  ReadingItem,
  RequirementConflict,
  RequirementItem,
  TestPlanItem,
  VerificationMode,
} from "../lib/api";
import {
  buildCoverageSummary,
  buildDecisionSnapshot,
  createTimelineEntry,
  type ConfidenceHistoryPoint,
  type TimelineEntry,
} from "../lib/workflow-intelligence";

interface UploadSectionProps {
  mode: VerificationMode;
  busy: boolean;
  workflowActive: boolean;
  onModeChange: (mode: VerificationMode) => void;
  onStart: (file: File) => void | Promise<void>;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  citations?: ChatCitation[];
}

const progressSteps = [
  { title: "Requirements", detail: "Extract measurable specs from the uploaded datasheet and detect conflicts." },
  { title: "Test Plan", detail: "Translate requirements into executable verification cases." },
  { title: "Script", detail: "Generate the Arduino validation sketch for the DUT." },
  { title: "Execution", detail: "Stream live hardware or simulation data with anomaly alerts." },
  { title: "Analysis", detail: "Compute SPC, failures, adaptive confidence, and autonomous follow-up." },
  { title: "Report", detail: "Package the report, evidence chat, and release decision into a final handoff." },
];

function clipText(value: string, limit = 120): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1).trimEnd()}...`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function compactNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export function UploadSection({ mode, busy, workflowActive, onModeChange, onStart }: UploadSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="panel stack upload-panel"
    >
      <div className="panel-headline-row">
        <div>
          <div className="eyebrow">Control desk</div>
          <h2 className="gradient-text" style={{ margin: 0 }}>Load a datasheet and arm the workflow</h2>
        </div>
        <p className="muted panel-aside">
          Keep the controls visible while the agent extracts specs, plans tests, streams evidence, and branches into follow-up runs.
        </p>
      </div>
      <div className="mode-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <button className={`mode-pill ${mode === "hardware" ? "active" : ""}`} disabled={busy} onClick={() => onModeChange("hardware")} type="button" style={{ textAlign: "left", minHeight: 96 }}>
          <strong style={{ display: "block", marginBottom: 6 }}>Hardware mode</strong>
          <span>Flash the Arduino rig and stream real serial measurements.</span>
        </button>
        <button className={`mode-pill ${mode === "simulation" ? "active" : ""}`} disabled={busy} onClick={() => onModeChange("simulation")} type="button" style={{ textAlign: "left", minHeight: 96 }}>
          <strong style={{ display: "block", marginBottom: 6 }}>Simulation mode</strong>
          <span>Run the full loop with deterministic demo data and batch insights.</span>
        </button>
      </div>
      <div style={{ position: "relative" }}>
        <div className="file-input" style={{ display: "grid", gap: 14, borderRadius: 24 }}>
          <input accept="application/pdf" type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
          <span className="signal-chip" style={{ width: "fit-content" }}>{selectedFile ? "PDF armed" : "PDF intake"}</span>
          <div>
            <h3 style={{ margin: "0 0 8px", fontSize: 24 }}>{selectedFile ? selectedFile.name : "Drop a datasheet here or browse from disk"}</h3>
            <p className="muted" style={{ margin: 0 }}>Use a PDF with measurable thresholds, limits, or timing specs for the cleanest extraction.</p>
          </div>
          {selectedFile ? (
            <div className="analysis-card accent-card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <div><div className="muted">Selected file</div><strong>{selectedFile.name}</strong></div>
              <div><div className="muted">Size</div><strong>{formatFileSize(selectedFile.size)}</strong></div>
              <div><div className="muted">Run action</div><strong>{workflowActive ? "Restart current run" : "Start fresh run"}</strong></div>
            </div>
          ) : null}
        </div>
        {busy ? (
          <motion.div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.56)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 24, color: "var(--accent-cyan)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Analysing document...
          </motion.div>
        ) : null}
      </div>
      <div className="button-row" style={{ alignItems: "flex-start" }}>
        <button className="action-btn" disabled={!selectedFile || busy} onClick={() => selectedFile && onStart(selectedFile)} type="button">
          {busy ? "Processing pipeline..." : workflowActive ? "Restart workflow" : "Initialize agentic flow"}
        </button>
        <span className="muted" style={{ maxWidth: 620 }}>
          {workflowActive ? "Starting again replaces the current dashboard state with a fresh traced run." : "The flow pauses after sketch generation so you can review the bench logic before execution."}
        </span>
      </div>
    </motion.section>
  );
}

export function VerificationDashboard() {
  const [mode, setMode] = useState<VerificationMode>("hardware");
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressIndex, setProgressIndex] = useState(-1);
  const [readyForReview, setReadyForReview] = useState(false);
  const [requirements, setRequirements] = useState<RequirementItem[]>([]);
  const [conflicts, setConflicts] = useState<RequirementConflict[]>([]);
  const [testPlan, setTestPlan] = useState<TestPlanItem[]>([]);
  const [script, setScript] = useState("");
  const [readings, setReadings] = useState<ReadingItem[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [followUpRuns, setFollowUpRuns] = useState<FollowUpRun[]>([]);
  const [batchAnalysis, setBatchAnalysis] = useState<BatchAnalysis | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [liveBanner, setLiveBanner] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyHighlight[]>([]);
  const [agentNote, setAgentNote] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [documentMeta, setDocumentMeta] = useState<ExtractionDocument | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEntry[]>([]);
  const [confidenceHistory, setConfidenceHistory] = useState<ConfidenceHistoryPoint[]>([]);

  const coverageSummary = buildCoverageSummary(requirements, testPlan, readings, analysis);
  const decisionSnapshot = buildDecisionSnapshot({
    busy,
    progressIndex,
    readyForReview,
    analysis,
    coverage: coverageSummary,
    readings,
    followUpRuns,
    anomalies,
    mode,
  });

  async function refreshModelStatus() {
    try {
      const api = await import("../lib/api");
      const status = await api.getModelStatus();
      setModelStatus(status);
    } catch {
      // Ignore status refresh failures; they should not interrupt the workflow.
    }
  }

  useEffect(() => {
    return () => {
      if (reportUrl) {
        URL.revokeObjectURL(reportUrl);
      }
    };
  }, [reportUrl]);

  useEffect(() => {
    const marker = {
      id: `${decisionSnapshot.state}-${decisionSnapshot.confidence.toFixed(2)}-${progressIndex}-${analysis?.failed ?? 0}-${coverageSummary.covered}-${coverageSummary.partial}-${coverageSummary.untested}`,
      label: decisionSnapshot.label,
      confidence: decisionSnapshot.confidence,
      note: decisionSnapshot.rationale,
    } satisfies ConfidenceHistoryPoint;

    setConfidenceHistory((current) => {
      if (current[current.length - 1]?.id === marker.id) {
        return current;
      }
      return [...current.slice(-5), marker];
    });
  }, [
    decisionSnapshot.state,
    decisionSnapshot.label,
    decisionSnapshot.confidence,
    decisionSnapshot.rationale,
    progressIndex,
    analysis?.failed,
    coverageSummary.covered,
    coverageSummary.partial,
    coverageSummary.untested,
  ]);

  function appendTimeline(entry: TimelineEntry) {
    setTimelineEvents((current) => [entry, ...current].slice(0, 18));
  }

  useEffect(() => {
    void refreshModelStatus();
  }, []);

  function resetState(fileName?: string) {
    setError(null);
    setReadyForReview(false);
    setProgressIndex(0);
    setRequirements([]);
    setConflicts([]);
    setTestPlan([]);
    setScript("");
    setReadings([]);
    setAnalysis(null);
    setFollowUpRuns([]);
    setBatchAnalysis(null);
    setLiveBanner(null);
    setAnomalies([]);
    setAgentNote(null);
    setChatMessages([]);
    setDocumentMeta(null);
    setRunId(null);
    setConfidenceHistory([]);
    setTimelineEvents(
      fileName
        ? [createTimelineEntry("Run", "Workflow armed", `Loaded ${fileName}. Preparing structured requirement extraction.`, "accent")]
        : [],
    );
    if (reportUrl) {
      URL.revokeObjectURL(reportUrl);
      setReportUrl(null);
    }
  }

  async function handleStart(file: File) {
    setBusy(true);
    resetState(file.name);

    try {
      const api = await import("../lib/api");
      const extraction = await api.extractRequirements(file, mode);
      setDocumentMeta(extraction.document);
      setRunId(extraction.run_id);
      setRequirements(extraction.requirements);
      setConflicts(extraction.conflicts);
      setProgressIndex(1);
      appendTimeline(
        createTimelineEntry(
          "Requirements",
          `Parsed ${extraction.document.page_count}-page datasheet`,
          `${extraction.requirements.length} measurable requirement${extraction.requirements.length === 1 ? "" : "s"} extracted from approximately ${compactNumber(extraction.document.approximate_input_tokens)} prompt tokens of source text.`,
          "success",
        ),
      );
      if (extraction.conflicts.length > 0) {
        appendTimeline(
          createTimelineEntry(
            "Requirements",
            `${extraction.conflicts.length} specification conflict${extraction.conflicts.length === 1 ? "" : "s"} flagged`,
            "The requirement guardrail found contradictory statements that should be reviewed before signoff.",
            "danger",
          ),
        );
      }

      const generatedTestPlan = await api.generateTestPlan(extraction.requirements, extraction.run_id);
      setTestPlan(generatedTestPlan);
      setProgressIndex(2);
      appendTimeline(
        createTimelineEntry(
          "Test plan",
          `${generatedTestPlan.length} executable case${generatedTestPlan.length === 1 ? "" : "s"} generated`,
          "Requirements were converted into a bench-ready verification recipe with pass criteria per case.",
          "accent",
        ),
      );

      const generatedScript = await api.generateScript(generatedTestPlan, extraction.run_id);
      setScript(generatedScript);
      setReadyForReview(true);
      appendTimeline(
        createTimelineEntry(
          "Script",
          "Bench sketch synthesized",
          `${generatedScript.split(/\r?\n/).length} lines of Arduino logic are ready. The pipeline is paused for review before execution.`,
          "success",
        ),
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Verification bootstrap failed.");
      setProgressIndex(-1);
      appendTimeline(
        createTimelineEntry(
          "Run",
          "Bootstrap failed",
          caughtError instanceof Error ? caughtError.message : "Verification bootstrap failed.",
          "danger",
        ),
      );
    } finally {
      setBusy(false);
      void refreshModelStatus();
    }
  }

  async function handleReviewAndFlash() {
    if (!script || testPlan.length === 0) {
      return;
    }

    setBusy(true);
    setError(null);
    setReadings([]);
    setAnomalies([]);
    setLiveBanner("Execution stream armed. Waiting for live readings...");
    setAgentNote("Agent is transitioning from planning into evidence collection.");
    appendTimeline(
      createTimelineEntry(
        "Execution",
        "Execution approved",
        `The generated sketch has been accepted and the ${mode} run is starting now.`,
        "accent",
      ),
    );

    try {
      const api = await import("../lib/api");
      if (mode === "hardware") {
        await api.flashArduino(script);
        setLiveBanner("Sketch flashed. Streaming serial data from the Arduino rig.");
        appendTimeline(
          createTimelineEntry(
            "Execution",
            "Arduino rig flashed",
            "The generated sketch is now live on the bench fixture and streaming serial telemetry.",
            "success",
          ),
        );
      }
      setProgressIndex(3);
      appendTimeline(
        createTimelineEntry(
          "Execution",
          "Live telemetry opened",
          `The dashboard is now receiving ${mode} readings in real time.`,
          "accent",
        ),
      );

      let streamedCount = 0;
      const streamedReadings = await api.streamExecution(mode, testPlan, 16, {
        onReading: (reading) => {
          streamedCount += 1;
          startTransition(() => {
            setReadings((current) => [...current, reading]);
          });
          if (!reading.is_anomaly) {
            setLiveBanner(`Streaming ${reading.phase} sample ${reading.test_id}: Gate ${reading.gate} at ${reading.measured_voltage.toFixed(3)} V`);
          }
          if (streamedCount === 1 || streamedCount % 6 === 0) {
            appendTimeline(
              createTimelineEntry(
                "Execution",
                `Evidence checkpoint ${streamedCount}`,
                `Captured Gate ${reading.gate} at A=${reading.input_a} B=${reading.input_b} with ${reading.measured_voltage.toFixed(3)} V during ${reading.phase}.`,
                reading.is_anomaly ? "danger" : "neutral",
              ),
            );
          }
        },
        onAnomaly: (anomaly) => {
          setLiveBanner(anomaly.message);
          setAnomalies((current) => [anomaly, ...current].slice(0, 6));
          setAgentNote(`Agent paused on ${anomaly.test_id}. It is checking spec margin, statistical weakness, and whether targeted follow-up should branch from this anomaly.`);
          appendTimeline(
            createTimelineEntry(
              "Anomaly",
              `${anomaly.test_id} crossed the spec corridor`,
              anomaly.message,
              anomaly.severity === "HIGH" ? "danger" : "accent",
            ),
          );
        },
        onComplete: (count) => {
          setLiveBanner(`Initial execution finished with ${count} streamed readings. Analysing now.`);
          appendTimeline(
            createTimelineEntry(
              "Execution",
              "Initial sweep complete",
              `The first pass captured ${count} streamed readings and is being handed to analysis.`,
              "success",
            ),
          );
        },
      }, runId);

      let aggregatedReadings = streamedReadings;
      let nextAnalysis = await api.analyseResults(aggregatedReadings, testPlan, runId);
      setAnalysis(nextAnalysis);
      setProgressIndex(4);
      appendTimeline(
        createTimelineEntry(
          "Analysis",
          `${nextAnalysis.overall_result} after first pass`,
          clipText(nextAnalysis.summary, 132),
          nextAnalysis.overall_result === "FAIL" ? "danger" : "success",
        ),
      );

      let executedRuns: FollowUpRun[] = [];
      if (nextAnalysis.follow_up_plan.length > 0) {
        setAgentNote(`Agent selected ${nextAnalysis.follow_up_plan.length} targeted rerun${nextAnalysis.follow_up_plan.length === 1 ? "" : "s"}. It is now collecting focused evidence before finalising the decision.`);
        appendTimeline(
          createTimelineEntry(
            "Follow-up",
            `${nextAnalysis.follow_up_plan.length} adaptive rerun${nextAnalysis.follow_up_plan.length === 1 ? "" : "s"} scheduled`,
            "The agent saw either a hard failure or weak statistical margin and branched into targeted characterization automatically.",
            "accent",
          ),
        );
        await delay(mode === "simulation" ? 550 : 320);
        const followUpResult = await api.runFollowUp(mode, testPlan, nextAnalysis.follow_up_plan, runId);
        executedRuns = followUpResult.runs;
        setFollowUpRuns(executedRuns);
        const followUpReadings = executedRuns.flatMap((run) => run.readings);
        startTransition(() => {
          setReadings((current) => [...current, ...followUpReadings]);
        });
        aggregatedReadings = [...aggregatedReadings, ...followUpReadings];
        setLiveBanner(followUpResult.summary);
        appendTimeline(
          createTimelineEntry(
            "Follow-up",
            "Targeted evidence collected",
            followUpResult.summary,
            "success",
          ),
        );
        nextAnalysis = await api.analyseResults(aggregatedReadings, testPlan, runId);
        setAnalysis(nextAnalysis);
        appendTimeline(
          createTimelineEntry(
            "Analysis",
            "Decision updated after follow-up",
            clipText(nextAnalysis.summary, 132),
            nextAnalysis.overall_result === "FAIL" ? "danger" : "success",
          ),
        );
      } else {
        setAgentNote("Agent found no failing or statistically weak condition severe enough to justify a targeted rerun.");
        appendTimeline(
          createTimelineEntry(
            "Follow-up",
            "No adaptive branch required",
            "The first-pass evidence was strong enough that the agent did not schedule a targeted rerun.",
            "neutral",
          ),
        );
      }

      let nextBatchAnalysis: BatchAnalysis | null = null;
      if (mode === "simulation") {
        nextBatchAnalysis = await api.runBatchAnalysis(testPlan, 5, runId);
        setBatchAnalysis(nextBatchAnalysis);
        appendTimeline(
          createTimelineEntry(
            "Predictive layer",
            nextBatchAnalysis.drift_detected ? "Cross-batch drift surfaced" : "Cross-batch comparison stable",
            clipText(nextBatchAnalysis.trend_summary, 132),
            nextBatchAnalysis.drift_detected ? "danger" : "accent",
          ),
        );
      }

      const reportBlob = await api.generateReport(nextAnalysis, requirements, testPlan, {
        conflicts,
        batchAnalysis: nextBatchAnalysis,
        followUpRuns: executedRuns,
        runId,
      });
      const nextUrl = URL.createObjectURL(reportBlob);
      if (reportUrl) {
        URL.revokeObjectURL(reportUrl);
      }
      setReportUrl(nextUrl);
      setProgressIndex(5);
      setReadyForReview(false);
      appendTimeline(
        createTimelineEntry(
          "Report",
          "Evidence package ready",
          "The PDF report, decision summary, and evidence-grounded chat are now available.",
          "success",
        ),
      );
      setChatMessages([
        {
          role: "assistant",
          text: nextAnalysis.summary,
          citations: nextAnalysis.failures.map((failure) => ({ kind: "failure", reference: failure.test_id, excerpt: failure.description })),
        },
      ]);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Execution failed after script review.";
      setError(message);
      appendTimeline(createTimelineEntry("Run", "Execution failed", message, "danger"));
    } finally {
      setBusy(false);
      void refreshModelStatus();
    }
  }

  async function handleAsk(question: string) {
    if (!analysis) {
      return;
    }
    setChatBusy(true);
    setChatMessages((current) => [...current, { role: "user", text: question }]);
    try {
      const api = await import("../lib/api");
      const response = await api.askResultsQuestion(
        question,
        analysis,
        readings,
        requirements,
        testPlan,
        batchAnalysis,
        coverageSummary as unknown as Record<string, unknown>,
        decisionSnapshot as unknown as Record<string, unknown>,
        runId,
      );
      setChatMessages((current) => [...current, { role: "assistant", text: response.answer, citations: response.citations }]);
      appendTimeline(
        createTimelineEntry(
          "Q&A",
          "Engineer queried the evidence graph",
          clipText(question, 120),
          "neutral",
        ),
      );
    } catch (caughtError) {
      setChatMessages((current) => [
        ...current,
        { role: "assistant", text: caughtError instanceof Error ? caughtError.message : "The question could not be answered." },
      ]);
    } finally {
      setChatBusy(false);
      void refreshModelStatus();
    }
  }

  const activeModelLabel = modelStatus ? modelStatus.active_provider : "Detecting";
  const activeModelNote = modelStatus
    ? clipText(
        `${modelStatus.active_model}${modelStatus.fallback_provider ? ` | fallback: ${modelStatus.fallback_model}` : ""}${modelStatus.fallback_used ? " | Bedrock fallback active" : ""}`,
        118,
      )
    : "Fetching current model routing from the backend.";

  const statItems = [
    { label: "Current mode", value: mode === "hardware" ? "Hardware" : "Simulation", note: "Hardware for real data, simulation for predictive batch runs." },
    { label: "Model", value: activeModelLabel, note: activeModelNote },
    { label: "Decision", value: decisionSnapshot.label, note: decisionSnapshot.next_action },
    { label: "Coverage", value: coverageSummary.total ? `${coverageSummary.covered}/${coverageSummary.total}` : "-", note: "Fully covered requirements in the current run scope." },
    { label: "Run ID", value: runId ? runId.slice(0, 8) : "pending", note: runId ? "Persisted workflow identity for Neon-backed storage." : "Run identity appears once extraction starts." },
  ];

  const firstRequirement = requirements[0];
  const firstTest = testPlan[0];
  const lastReading = readings[readings.length - 1];
  const scriptLineCount = script ? script.split(/\r?\n/).length : 0;
  const worstGroup = analysis?.spc_summary.groups.find((group) => group.group_id === analysis.spc_summary.worst_group) ?? analysis?.spc_summary.groups[0];
  const reportInsight = mode === "simulation" && batchAnalysis
    ? clipText(batchAnalysis.trend_summary, 124)
    : "Result chat is grounded on failures, coverage gaps, and the current decision state once the report is ready.";

  const stepInsights: StepInsight[] = [
    {
      summary: requirements.length
        ? `${requirements.length} structured requirement${requirements.length === 1 ? "" : "s"} extracted from the uploaded datasheet.`
        : "Waiting for the uploaded datasheet so extraction can begin.",
      items: requirements.length
        ? [
            documentMeta
              ? `${documentMeta.page_count} pages and ${documentMeta.character_count.toLocaleString()} extracted characters flowed into the extractor.`
              : "Document metadata will appear once the PDF is parsed.",
            conflicts.length
              ? `${conflicts.length} requirement conflict${conflicts.length === 1 ? "" : "s"} detected for review.`
              : "No contradictory requirement statements were found in the extracted spec set.",
            firstRequirement
              ? `${firstRequirement.id}: ${clipText(firstRequirement.acceptance_criteria, 90)}`
              : "Requirement extraction finished cleanly.",
          ]
        : ["Upload a datasheet PDF to populate extracted requirements and conflict checks."],
    },
    {
      summary: testPlan.length
        ? `${testPlan.length} executable verification case${testPlan.length === 1 ? "" : "s"} generated from the extracted requirements.`
        : "The agent will convert extracted requirements into a structured test plan here.",
      items: testPlan.length
        ? [
            `${testPlan.length} planned test vector${testPlan.length === 1 ? "" : "s"} are ready for script generation.`,
            firstTest ? `${firstTest.test_id}: ${clipText(firstTest.test_name, 88)}` : "Test plan generation completed.",
            firstTest ? `Pass criteria sample: ${clipText(firstTest.pass_criteria, 92)}` : "Pass criteria are attached to each test case.",
          ]
        : ["No test plan has been generated yet."],
    },
    {
      summary: script
        ? readyForReview
          ? "Arduino sketch generated and paused for explicit review before the bench run starts."
          : "Arduino sketch generated and already handed to the execution phase."
        : "The generated test plan will be compiled into the Arduino validation sketch here.",
      items: script
        ? [
            `${scriptLineCount} line${scriptLineCount === 1 ? "" : "s"} of bench logic prepared for ${mode} mode.`,
            readyForReview
              ? "Pipeline is intentionally paused so the generated sketch can be reviewed before flashing."
              : "Sketch approval has already happened and execution has moved forward.",
            "The generated sketch drives the DUT and emits the telemetry used by the live dashboard.",
          ]
        : ["Script generation starts after the test plan is ready."],
    },
    {
      summary: readings.length
        ? `${readings.length} streamed reading${readings.length === 1 ? "" : "s"} captured from the ${mode === "hardware" ? "bench rig" : "simulator"}.`
        : "Execution has not started yet. The live chart and anomaly feed will appear here.",
      items: readings.length
        ? [
            lastReading
              ? `Latest sample ${lastReading.test_id}: Gate ${lastReading.gate} measured ${lastReading.measured_voltage.toFixed(3)} V in ${lastReading.phase}.`
              : "Execution stream is active.",
            anomalies.length
              ? `${anomalies.length} anomaly highlight${anomalies.length === 1 ? "" : "s"} raised during live streaming.`
              : "No live anomaly thresholds have been crossed so far.",
            followUpRuns.length
              ? `${followUpRuns.length} targeted follow-up run${followUpRuns.length === 1 ? "" : "s"} appended after the initial sweep.`
              : clipText(liveBanner ?? "Streaming telemetry updates the dashboard in real time.", 104),
          ]
        : [mode === "hardware" ? "Approve the sketch to start the Arduino-backed hardware stream." : "Approve the sketch to start the simulation stream."],
    },
    {
      summary: analysis
        ? `${analysis.overall_result} after ${analysis.total_tests} evaluated condition${analysis.total_tests === 1 ? "" : "s"}, with SPC and follow-up logic included.`
        : "Analysis starts as soon as the first execution pass completes.",
      items: analysis
        ? [
            clipText(analysis.summary, 120),
            worstGroup
              ? `Worst SPC group: ${worstGroup.group_id}${worstGroup.cpk !== null ? ` with Cpk ${worstGroup.cpk.toFixed(2)}` : ""}.`
              : "SPC groups are ready once enough measurements have been collected.",
            analysis.follow_up_plan.length
              ? `${analysis.follow_up_plan.length} autonomous follow-up plan${analysis.follow_up_plan.length === 1 ? "" : "s"} created from the first analysis pass.`
              : "The agent did not need to schedule additional targeted reruns.",
          ]
        : ["Failure analysis, SPC, and targeted follow-up planning will appear here."],
    },
    {
      summary: reportUrl
        ? "Final report generated. Download, decision review, and result chat are ready."
        : "Final packaging starts after analysis, any follow-up runs, and optional batch prediction finish.",
      items: reportUrl
        ? [
            "The PDF report is generated and ready for download from the dashboard.",
            reportInsight,
            chatMessages.length
              ? `${chatMessages.length} chat message${chatMessages.length === 1 ? "" : "s"} already grounded on captured verification data.`
              : "Ask follow-up engineering questions once the report is available.",
          ]
        : ["The report stage is still waiting on the upstream pipeline outputs."],
    },
  ];

  const workspaceIntro =
    progressIndex < 0
      ? "Start a run to populate the active workspace."
      : readyForReview
        ? "The agent has paused after script generation so you can review the bench logic before execution."
        : progressIndex === 5
          ? "The run is complete. Review the final evidence, report, and Q&A from one place."
          : "The workspace stays focused on the active stage so the operator is not scanning unrelated panels.";

  const renderWorkspace = () => {
    if (progressIndex === 1) {
      return {
        title: "Requirements review",
        content: (
          <section className="content-grid">
            <RequirementsTable requirements={requirements} />
            <ConflictPanel conflicts={conflicts} />
          </section>
        ),
      };
    }

    if (progressIndex === 2) {
      return {
        title: "Planning and script review",
        content: (
          <section className="content-grid">
            <TestPlanTable testPlan={testPlan} />
            <ScriptViewer script={script} mode={mode} busy={busy} onApprove={handleReviewAndFlash} ready={readyForReview} />
          </section>
        ),
      };
    }

    if (progressIndex === 3) {
      return {
        title: "Execution stream",
        content: (
          <section className="content-grid">
            <LiveReadings readings={readings} liveBanner={liveBanner} anomalies={anomalies} />
            <AgentLoopPanel analysis={analysis} followUpRuns={followUpRuns} agentNote={agentNote} />
          </section>
        ),
      };
    }

    if (progressIndex === 4) {
      return {
        title: "Analysis and follow-up",
        content: (
          <div style={{ display: "grid", gap: "24px" }}>
            <section className="content-grid">
              <AnalysisPanel analysis={analysis} />
              <StatisticalPanel analysis={analysis} />
            </section>
            <section className="content-grid">
              <AgentLoopPanel analysis={analysis} followUpRuns={followUpRuns} agentNote={agentNote} />
              {mode === "simulation" ? <BatchInsightPanel batchAnalysis={batchAnalysis} /> : <div />}
            </section>
          </div>
        ),
      };
    }

    if (progressIndex === 5) {
      return {
        title: "Final evidence package",
        content: (
          <div style={{ display: "grid", gap: "24px" }}>
            <section className="content-grid">
              <AnalysisPanel analysis={analysis} />
              <ReportDownload reportUrl={reportUrl} busy={busy} />
            </section>
            <section className="content-grid">
              <ResultsChatPanel ready={Boolean(analysis)} busy={chatBusy} messages={chatMessages} onAsk={handleAsk} />
              <AgentLoopPanel analysis={analysis} followUpRuns={followUpRuns} agentNote={agentNote} />
            </section>
          </div>
        ),
      };
    }

    return {
      title: "Active workspace",
      content: null,
    };
  };

  const workspace = renderWorkspace();
  return (
    <main className="page-shell">
      <div className="page-grid">
        <motion.section
          initial={{ opacity: 0, rotateX: 10, y: 30 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hero"
          style={{ perspective: "1200px" }}
        >
          <div className="panel panel-dark hero-card" style={{ transformStyle: "preserve-3d" }}>
            <div className="hero-aurora hero-aurora-left" />
            <div className="hero-aurora hero-aurora-right" />
            <div className="eyebrow" style={{ transform: "translateZ(34px)" }}>AI Product Verification Engineer</div>
            <h1 className="headline" style={{ transform: "translateZ(54px)" }}>Agentic verification with a real hardware control surface.</h1>
            <p className="subhead" style={{ transform: "translateZ(24px)" }}>
              Upload a datasheet, generate the plan and Arduino sketch, stream real or simulated evidence, let the agent branch into targeted reruns, and keep the operator oriented with coverage, timeline, and decision state in one view.
            </p>
            <div className="hero-signal-row" style={{ transform: "translateZ(28px)" }}>
              <span className="signal-chip">timeline playback</span>
              <span className="signal-chip">adaptive follow-up</span>
              <span className="signal-chip">coverage gap detection</span>
              {modelStatus ? (
                <span className="signal-chip">{`${modelStatus.active_provider}: ${modelStatus.active_model.split("/").pop() ?? modelStatus.active_model}`}</span>
              ) : (
                <span className="signal-chip">model routing</span>
              )}
              {modelStatus?.fallback_provider ? (
                <span className="signal-chip">{modelStatus.fallback_used ? "bedrock fallback active" : "bedrock fallback armed"}</span>
              ) : null}
            </div>
          </div>
          <div className="panel stack hero-side-panel">
            <div className="eyebrow">Live snapshot</div>
            <div className="stats-grid compact-grid">
              {statItems.map((item) => (
                <div className="metric-card metric-card-glow" key={item.label}>
                  <div className="muted">{item.label}</div>
                  <div className="metric-value metric-value-tight">{item.value}</div>
                  <div className="muted">{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Operations</div>
              <h2 style={{ margin: 0 }}>Workflow controls</h2>
            </div>
            <p className="muted panel-aside">
              Set the mode, load the source document, and inspect run progress without mixing in the execution panels.
            </p>
          </div>
          <div className="control-grid">
            <UploadSection mode={mode} busy={busy} workflowActive={progressIndex >= 0} onModeChange={setMode} onStart={handleStart} />
            <PipelineProgress
              steps={progressSteps}
              stepInsights={stepInsights}
              activeIndex={progressIndex}
              readyForReview={readyForReview}
              workflowComplete={Boolean(reportUrl)}
            />
          </div>
        </section>

        {progressIndex >= 0 ? (
          <section className="section-block">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Overview</div>
                <h2 style={{ margin: 0 }}>Decision and coverage</h2>
              </div>
              <p className="muted panel-aside">
                Keep release state, confidence history, and requirement coverage in one stable area while the active workspace changes beneath it.
              </p>
            </div>
            <section className="dashboard-mosaic">
              <DecisionPanel decision={decisionSnapshot} history={confidenceHistory} />
              <CoveragePanel coverage={coverageSummary} />
            </section>
          </section>
        ) : null}

        {progressIndex >= 0 ? (
          <section className="section-block">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Trace</div>
                <h2 style={{ margin: 0 }}>Agent timeline</h2>
              </div>
              <p className="muted panel-aside">
                The reasoning log stays separate from the workspace so playback does not compete with the current task.
              </p>
            </div>
            <AgentTimelinePanel events={timelineEvents} />
          </section>
        ) : null}

        {error ? (
          <motion.section
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="panel"
            style={{ borderColor: "var(--danger)", boxShadow: "0 0 20px rgba(255,51,102,0.2)" }}
          >
            <div className="eyebrow" style={{ color: "var(--danger)" }}>Pipeline interruption</div>
            <h2 style={{ marginTop: 12, color: "var(--danger)" }}>Execution halted</h2>
            <p>{error}</p>
          </motion.section>
        ) : null}
        {progressIndex >= 0 ? (
          <section className="section-block">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Workspace</div>
                <h2 style={{ margin: 0 }}>{workspace.title}</h2>
              </div>
              <p className="muted panel-aside">{workspaceIntro}</p>
            </div>
            <div className="workspace-shell">
              <AnimatePresence mode="wait">
                {workspace.content ? (
                  <motion.div
                    initial={{ opacity: 0, y: 26 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    key={`workspace-${progressIndex}`}
                    style={{ display: "grid", gap: "24px" }}
                  >
                    {workspace.content}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}












