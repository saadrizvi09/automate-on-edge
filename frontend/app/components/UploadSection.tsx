"use client";

import { startTransition, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { AgentLoopPanel } from "./AgentLoopPanel";
import { AnalysisPanel } from "./AnalysisPanel";
import { BatchInsightPanel } from "./BatchInsightPanel";
import { ConflictPanel } from "./ConflictPanel";
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
  BatchAnalysis,
  ChatCitation,
  FollowUpRun,
  ReadingItem,
  RequirementConflict,
  RequirementItem,
  TestPlanItem,
  VerificationMode,
  AnomalyHighlight,
} from "../lib/api";

interface UploadSectionProps {
  mode: VerificationMode;
  busy: boolean;
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
  { title: "Analysis", detail: "Compute SPC, failures, and an autonomous follow-up plan." },
  { title: "Report", detail: "Package the DVP narrative, SPC, follow-up, and predictive views into PDF form." },
];

function clipText(value: string, limit = 120): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1).trimEnd()}...`;
}

export function UploadSection({ mode, busy, onModeChange, onStart }: UploadSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="panel stack"
    >
      <div className="eyebrow">Stage 1</div>
      <h2
        style={{
          margin: 0,
          background: "linear-gradient(135deg, rgba(255,255,255,1), rgba(124,245,255,0.82))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Upload datasheet and choose execution mode
      </h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Hardware mode streams real serial data from the Arduino rig. Simulation mode unlocks autonomous batch prediction and synthetic drift studies.
      </p>
      <div className="mode-row">
        <button className={`mode-pill ${mode === "hardware" ? "active" : ""}`} onClick={() => onModeChange("hardware")} type="button">
          Hardware mode
        </button>
        <button className={`mode-pill ${mode === "simulation" ? "active" : ""}`} onClick={() => onModeChange("simulation")} type="button">
          Simulation mode
        </button>
      </div>
      <div style={{ position: "relative" }}>
        <input
          className="file-input"
          accept="application/pdf"
          type="file"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
        {busy && (
           <motion.div 
             style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.56)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 20, color: "var(--accent-cyan)" }}
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
           >
              Analysing Document...
           </motion.div>
        )}
      </div>
      <div className="button-row">
        <button className="action-btn" disabled={!selectedFile || busy} onClick={() => selectedFile && onStart(selectedFile)} type="button">
          {busy ? "Processing Pipeline..." : "Initialize Agentic Flow"}
        </button>
        <span className="muted">The pipeline pauses after script generation for explicit review.</span>
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

  useEffect(() => {
    return () => {
      if (reportUrl) {
        URL.revokeObjectURL(reportUrl);
      }
    };
  }, [reportUrl]);

  function resetState() {
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
    if (reportUrl) {
      URL.revokeObjectURL(reportUrl);
      setReportUrl(null);
    }
  }

  async function handleStart(file: File) {
    setBusy(true);
    resetState();

    try {
      const api = await import("../lib/api");
      const extraction = await api.extractRequirements(file);
      setRequirements(extraction.requirements);
      setConflicts(extraction.conflicts);
      setProgressIndex(1);

      const generatedTestPlan = await api.generateTestPlan(extraction.requirements);
      setTestPlan(generatedTestPlan);
      setProgressIndex(2);

      const generatedScript = await api.generateScript(generatedTestPlan);
      setScript(generatedScript);
      setReadyForReview(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Verification bootstrap failed.");
      setProgressIndex(-1);
    } finally {
      setBusy(false);
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
    setAgentNote(null);

    try {
      const api = await import("../lib/api");
      if (mode === "hardware") {
        await api.flashArduino(script);
        setLiveBanner("Sketch flashed. Streaming serial data from the Arduino rig.");
      }
      setProgressIndex(3);

      const streamedReadings = await api.streamExecution(mode, testPlan, 16, {
        onReading: (reading) => {
          startTransition(() => {
            setReadings((current) => [...current, reading]);
          });
          if (!reading.is_anomaly) {
            setLiveBanner(`Streaming ${reading.phase} sample ${reading.test_id}: Gate ${reading.gate} at ${reading.measured_voltage.toFixed(3)} V`);
          }
        },
        onAnomaly: (anomaly) => {
          setLiveBanner(anomaly.message);
          setAnomalies((current) => [anomaly, ...current].slice(0, 6));
        },
        onComplete: (count) => {
          setLiveBanner(`Initial execution finished with ${count} streamed readings. Analysing now.`);
        },
      });

      let aggregatedReadings = streamedReadings;
      let nextAnalysis = await api.analyseResults(aggregatedReadings, testPlan);
      setAnalysis(nextAnalysis);
      setProgressIndex(4);

      let executedRuns: FollowUpRun[] = [];
      if (nextAnalysis.follow_up_plan.length > 0) {
        setAgentNote(`Agent selected ${nextAnalysis.follow_up_plan.length} targeted rerun(s) and is collecting more evidence now.`);
        const followUpResult = await api.runFollowUp(mode, testPlan, nextAnalysis.follow_up_plan);
        executedRuns = followUpResult.runs;
        setFollowUpRuns(executedRuns);
        const followUpReadings = executedRuns.flatMap((run) => run.readings);
        startTransition(() => {
          setReadings((current) => [...current, ...followUpReadings]);
        });
        aggregatedReadings = [...aggregatedReadings, ...followUpReadings];
        setLiveBanner(followUpResult.summary);
        nextAnalysis = await api.analyseResults(aggregatedReadings, testPlan);
        setAnalysis(nextAnalysis);
      } else {
        setAgentNote("Agent found no failing or statistically weak condition that required a targeted rerun.");
      }

      let nextBatchAnalysis: BatchAnalysis | null = null;
      if (mode === "simulation") {
        nextBatchAnalysis = await api.runBatchAnalysis(testPlan, 5);
        setBatchAnalysis(nextBatchAnalysis);
      }

      const reportBlob = await api.generateReport(nextAnalysis, requirements, testPlan, {
        conflicts,
        batchAnalysis: nextBatchAnalysis,
        followUpRuns: executedRuns,
      });
      const nextUrl = URL.createObjectURL(reportBlob);
      if (reportUrl) {
        URL.revokeObjectURL(reportUrl);
      }
      setReportUrl(nextUrl);
      setProgressIndex(5);
      setReadyForReview(false);
      setChatMessages([
        {
          role: "assistant",
          text: nextAnalysis.summary,
          citations: nextAnalysis.failures.map((failure) => ({ kind: "failure", reference: failure.test_id, excerpt: failure.description })),
        },
      ]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Execution failed after script review.");
    } finally {
      setBusy(false);
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
      const response = await api.askResultsQuestion(question, analysis, readings, requirements, testPlan, batchAnalysis);
      setChatMessages((current) => [...current, { role: "assistant", text: response.answer, citations: response.citations }]);
    } catch (caughtError) {
      setChatMessages((current) => [
        ...current,
        { role: "assistant", text: caughtError instanceof Error ? caughtError.message : "The question could not be answered." },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  const statItems = [
    { label: "Current mode", value: mode === "hardware" ? "Hardware" : "Simulation", note: "Hardware for real data, simulation for predictive batch runs." },
    { label: "Requirements", value: String(requirements.length), note: "Structured constraints parsed from the datasheet." },
    { label: "Readings", value: String(readings.length), note: "Streaming evidence currently in memory." },
    { label: "Conflicts", value: String(conflicts.length), note: "Contradictory specification statements detected." },
  ];

  const firstRequirement = requirements[0];
  const firstTest = testPlan[0];
  const lastReading = readings[readings.length - 1];
  const scriptLineCount = script ? script.split(/\r?\n/).length : 0;
  const worstGroup = analysis?.spc_summary.groups.find((group) => group.group_id === analysis.spc_summary.worst_group) ?? analysis?.spc_summary.groups[0];
  const reportInsight = mode === "simulation" && batchAnalysis
    ? clipText(batchAnalysis.trend_summary, 124)
    : "Result chat is unlocked once the final analysis and report are ready.";

  const stepInsights: StepInsight[] = [
    {
      summary: requirements.length
        ? `${requirements.length} structured requirement${requirements.length === 1 ? "" : "s"} extracted from the uploaded datasheet.`
        : "Waiting for the uploaded datasheet so extraction can begin.",
      items: requirements.length
        ? [
            `${requirements.length} measurable constraint${requirements.length === 1 ? "" : "s"} parsed into the verification workspace.`,
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
        ? "Final report generated. Download, presentation, and result chat are ready."
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

  return (
    <main className="page-shell">
      <div className="page-grid">
        <motion.section 
          initial={{ opacity: 0, rotateX: 10, y: 30 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hero" 
          style={{ perspective: "1000px" }}
        >
          <div className="panel panel-dark" style={{ transformStyle: "preserve-3d" }}>
            <div className="eyebrow" style={{ transform: "translateZ(30px)" }}>AI Product Verification Engineer</div>
            <h1 className="headline" style={{ transform: "translateZ(50px)" }}>Agentic verification, live on the bench.</h1>
            <p className="subhead" style={{ transform: "translateZ(20px)" }}>
              Upload a datasheet, generate the test plan and Arduino sketch, stream live readings from the DUT, let the
              agent launch follow-up tests, compute SPC and batch risk, then interrogate the results in plain English.
            </p>
            <div style={{
              position: "absolute",
              right: "-10%",
              top: "-20%",
              width: "400px",
              height: "400px",
              background: "radial-gradient(circle, var(--cyan-dim) 0%, transparent 70%)",
              filter: "blur(40px)",
              zIndex: -1,
              pointerEvents: "none"
            }} />
          </div>
          <div className="panel stack">
            <div className="eyebrow">Live snapshot</div>
            <div className="stats-grid compact-grid">
              {statItems.map((item) => (
                <div className="metric-card" key={item.label}>
                  <div className="muted">{item.label}</div>
                  <div className="metric-value">{item.value}</div>
                  <div className="muted">{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <AnimatePresence mode="wait">
        {progressIndex < 1 && (
          <UploadSection mode={mode} busy={busy} onModeChange={setMode} onStart={handleStart} key="upload-section" />
        )}
        </AnimatePresence>
        
        {progressIndex >= 0 && (
          <PipelineProgress
            steps={progressSteps}
            stepInsights={stepInsights}
            activeIndex={progressIndex}
            readyForReview={readyForReview}
            workflowComplete={Boolean(reportUrl)}
          />
        )}

        {error && (
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
        )}

        <AnimatePresence mode="popLayout">
        {progressIndex === 1 && (
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="content-grid"
            key="stage-1"
          >
            <RequirementsTable requirements={requirements} />
            <ConflictPanel conflicts={conflicts} />
          </motion.section>
        )}

        {progressIndex === 2 && (
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="content-grid"
            key="stage-2"
          >
            <TestPlanTable testPlan={testPlan} />
            <ScriptViewer script={script} mode={mode} busy={busy} onApprove={handleReviewAndFlash} ready={readyForReview} />
          </motion.section>
        )}

        {progressIndex === 3 && (
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="content-grid"
            key="stage-3"
          >
            <LiveReadings readings={readings} liveBanner={liveBanner} anomalies={anomalies} />
            <AgentLoopPanel analysis={analysis} followUpRuns={followUpRuns} agentNote={agentNote} />
          </motion.section>
        )}

        {progressIndex === 4 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            key="stage-4"
            style={{ display: "grid", gap: "24px" }}
          >
            <section className="content-grid">
              <AnalysisPanel analysis={analysis} />
              <StatisticalPanel analysis={analysis} />
            </section>
            <section className="content-grid">
              <AgentLoopPanel analysis={analysis} followUpRuns={followUpRuns} agentNote={agentNote} />
              {mode === "simulation" && <BatchInsightPanel batchAnalysis={batchAnalysis} />}
            </section>
          </motion.div>
        )}

        {progressIndex === 5 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            key="stage-5"
            style={{ display: "grid", gap: "24px" }}
          >
            <section className="content-grid">
              <AnalysisPanel analysis={analysis} />
              <ReportDownload reportUrl={reportUrl} busy={busy} />
            </section>
            <ResultsChatPanel ready={Boolean(analysis)} busy={chatBusy} messages={chatMessages} onAsk={handleAsk} />
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </main>
  );
}


