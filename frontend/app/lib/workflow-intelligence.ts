import type {
  AnalysisResult,
  AnomalyHighlight,
  FollowUpRun,
  ReadingItem,
  RequirementItem,
  TestPlanItem,
  VerificationMode,
} from "./api";

export type TimelineTone = "neutral" | "accent" | "danger" | "success";
export type CoverageStatus = "covered" | "partial" | "untested";
export type DecisionState =
  | "idle"
  | "extracting"
  | "planning"
  | "review"
  | "executing"
  | "investigating"
  | "qualified"
  | "rejected"
  | "inconclusive";

export interface TimelineEntry {
  id: string;
  stage: string;
  headline: string;
  detail: string;
  tone: TimelineTone;
  timestamp: string;
}

export interface CoverageItem {
  id: string;
  description: string;
  linked_tests: number;
  linked_readings: number;
  status: CoverageStatus;
  note: string;
}

export interface CoverageSummary {
  total: number;
  covered: number;
  partial: number;
  untested: number;
  coverage_ratio: number;
  gaps: string[];
  items: CoverageItem[];
}

export interface DecisionSnapshot {
  state: DecisionState;
  label: string;
  confidence: number;
  rationale: string;
  next_action: string;
  evidence: string[];
}

export interface ConfidenceHistoryPoint {
  id: string;
  label: string;
  confidence: number;
  note: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createTimelineEntry(
  stage: string,
  headline: string,
  detail: string,
  tone: TimelineTone = "neutral",
): TimelineEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stage,
    headline,
    detail,
    tone,
    timestamp: new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date()),
  };
}

export function buildCoverageSummary(
  requirements: RequirementItem[],
  testPlan: TestPlanItem[],
  readings: ReadingItem[],
  analysis: AnalysisResult | null,
): CoverageSummary {
  const readingsByTest = new Map<string, number>();
  for (const reading of readings) {
    readingsByTest.set(reading.test_id, (readingsByTest.get(reading.test_id) ?? 0) + 1);
  }

  const items = requirements.map((requirement) => {
    const linkedTests = testPlan.filter((test) => test.requirement_id === requirement.id);
    const linkedReadings = linkedTests.reduce((total, test) => total + (readingsByTest.get(test.test_id) ?? 0), 0);
    const linkedFailures = linkedTests.filter((test) =>
      (analysis?.failures ?? []).some((failure) => failure.test_id === test.test_id),
    );

    let status: CoverageStatus = "untested";
    let note = "No executable test has been mapped to this requirement yet.";

    if (linkedTests.length > 0) {
      status = "partial";
      note = "Mapped into the plan but not yet exercised on the bench or simulator.";
    }
    if (linkedReadings > 0) {
      const completeTestCount = linkedTests.filter((test) => (readingsByTest.get(test.test_id) ?? 0) > 0).length;
      status = completeTestCount === linkedTests.length ? "covered" : "partial";
      note = linkedFailures.length
        ? `Evidence captured, but ${linkedFailures.length} linked condition${linkedFailures.length === 1 ? "" : "s"} currently fails.`
        : "Evidence captured and linked to this requirement.";
    }

    return {
      id: requirement.id,
      description: requirement.description,
      linked_tests: linkedTests.length,
      linked_readings: linkedReadings,
      status,
      note,
    } satisfies CoverageItem;
  });

  const covered = items.filter((item) => item.status === "covered").length;
  const partial = items.filter((item) => item.status === "partial").length;
  const untested = items.filter((item) => item.status === "untested").length;
  const total = items.length;
  const coverageRatio = total === 0 ? 0 : clamp((covered + partial * 0.5) / total, 0, 1);
  const gaps = items
    .filter((item) => item.status !== "covered")
    .slice(0, 4)
    .map((item) => `${item.id}: ${item.note}`);

  return {
    total,
    covered,
    partial,
    untested,
    coverage_ratio: coverageRatio,
    gaps,
    items,
  };
}

export function buildDecisionSnapshot(options: {
  busy: boolean;
  progressIndex: number;
  readyForReview: boolean;
  analysis: AnalysisResult | null;
  coverage: CoverageSummary;
  readings: ReadingItem[];
  followUpRuns: FollowUpRun[];
  anomalies: AnomalyHighlight[];
  mode: VerificationMode;
}): DecisionSnapshot {
  const { busy, progressIndex, readyForReview, analysis, coverage, readings, followUpRuns, anomalies, mode } = options;

  let state: DecisionState = "idle";
  let label = "Awaiting datasheet";
  let rationale = "Upload a datasheet to let the agent build a scoped verification run.";
  let nextAction = "Provide the source PDF and pick hardware or simulation mode.";
  const evidence: string[] = [];

  if (busy && progressIndex <= 0) {
    state = "extracting";
    label = "Extracting measurable requirements";
    rationale = "The agent is parsing the datasheet into structured electrical requirements.";
    nextAction = "Wait for requirement extraction and conflict checks to finish.";
  } else if (progressIndex === 1 || (busy && progressIndex === 1)) {
    state = "planning";
    label = "Building executable test plan";
    rationale = "Requirements are now being translated into bench-ready verification cases.";
    nextAction = "Wait for the plan and generated script to be prepared.";
  } else if (readyForReview) {
    state = "review";
    label = "Awaiting script approval";
    rationale = "The generated Arduino sketch is ready and the pipeline is paused for explicit review.";
    nextAction = "Approve execution to flash the rig or start the simulation stream.";
  } else if ((busy && progressIndex === 3) || (progressIndex === 3 && !analysis)) {
    state = anomalies.length > 0 ? "investigating" : "executing";
    label = anomalies.length > 0 ? "Investigating live anomaly" : `Collecting ${mode} evidence`;
    rationale = anomalies.length > 0
      ? "An out-of-spec reading has appeared and the agent is deciding whether to branch into follow-up testing."
      : "The agent is streaming live readings and building the first evidence set.";
    nextAction = anomalies.length > 0 ? "Hold for anomaly triage and targeted reruns." : "Continue the initial execution sweep.";
  } else if (analysis) {
    const worstGroup = analysis.spc_summary.groups.find((group) => group.group_id === analysis.spc_summary.worst_group);
    if (analysis.overall_result === "FAIL") {
      state = "rejected";
      label = "Reject candidate";
      rationale = analysis.failures[0]?.description ?? "One or more verification conditions failed.";
      nextAction = followUpRuns.length > 0
        ? "Quarantine the DUT, inspect the failing condition, then rerun after corrective action."
        : "Run targeted follow-up evidence collection or replace the DUT before release.";
    } else if (coverage.untested > 0 || coverage.partial > 0) {
      state = "inconclusive";
      label = "Evidence incomplete";
      rationale = coverage.gaps[0] ?? "The DUT currently passes, but some mapped requirements are only partially covered.";
      nextAction = "Close the remaining coverage gaps before signing off on qualification.";
    } else if (!analysis.spc_summary.capable || (worstGroup?.cpk ?? 2) < 1.33) {
      state = "inconclusive";
      label = "Passes now, but process is weak";
      rationale = "The current readings pass the limit check, but capability is below the preferred threshold for a robust release decision.";
      nextAction = "Run more samples or wider corners to strengthen confidence before release.";
    } else {
      state = "qualified";
      label = "Qualified for current scope";
      rationale = "The captured readings pass the measured limits and the covered requirement set is complete for this run scope.";
      nextAction = "Generate the report, preserve the evidence bundle, and compare future lots against this golden run.";
    }
  }

  if (analysis) {
    evidence.push(`${analysis.total_tests} analysed condition${analysis.total_tests === 1 ? "" : "s"}`);
    evidence.push(`${analysis.failed} fail / ${analysis.passed} pass`);
  }
  if (readings.length > 0) {
    evidence.push(`${readings.length} streamed reading${readings.length === 1 ? "" : "s"}`);
  }
  if (followUpRuns.length > 0) {
    evidence.push(`${followUpRuns.length} adaptive follow-up run${followUpRuns.length === 1 ? "" : "s"}`);
  }
  if (coverage.total > 0) {
    evidence.push(`${coverage.covered}/${coverage.total} requirements fully covered`);
  }

  let confidence = 0.18;
  confidence += clamp(readings.length / 64, 0, 0.2);
  confidence += coverage.coverage_ratio * 0.22;
  confidence += followUpRuns.length > 0 ? 0.08 : 0;
  confidence += anomalies.length > 0 ? 0.04 : 0;
  if (analysis) {
    confidence += 0.16;
    confidence += analysis.overall_result === "FAIL" ? 0.1 : 0.04;
    confidence += analysis.failed > 0 ? Math.min(analysis.failed * 0.02, 0.08) : 0;
    if (!analysis.spc_summary.capable) {
      confidence -= 0.05;
    }
  }
  confidence -= coverage.untested * 0.06;
  confidence -= coverage.partial * 0.03;
  confidence = clamp(confidence, 0.12, 0.98);

  return {
    state,
    label,
    confidence,
    rationale,
    next_action: nextAction,
    evidence,
  };
}
