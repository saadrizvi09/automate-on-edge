export type VerificationMode = "hardware" | "simulation";

export interface RequirementItem {
  id: string;
  description: string;
  acceptance_criteria: string;
  test_method: string;
}

export interface RequirementConflict {
  conflict_id: string;
  requirement_ids: string[];
  subject: string;
  explanation: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface TestPlanItem {
  test_id: string;
  requirement_id: string;
  test_name: string;
  steps: string[];
  expected_result: string;
  pass_criteria: string;
}

export interface ReadingItem {
  test_id: string;
  gate: number;
  input_a: number;
  input_b: number;
  measured_voltage: number;
  expected_state: "HIGH" | "LOW";
  expected_voltage_min: number;
  expected_voltage_max: number | null;
  spec_limit: string;
  result: string;
  source: string;
  phase: string;
  batch_id: string | null;
  timestamp: string;
  is_anomaly: boolean;
  violation_margin: number;
  supply_voltage: number;
}

export interface AnalysisFailure {
  test_id: string;
  description: string;
  measured: string;
  spec: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  root_cause: string;
  recommendation: string;
}

export interface BellCurvePoint {
  x: number;
  y: number;
}

export interface SpcGroup {
  group_id: string;
  gate: number;
  input_a: number;
  input_b: number;
  expected_state: "HIGH" | "LOW";
  samples: number;
  mean_voltage: number;
  std_dev: number;
  min_voltage: number;
  max_voltage: number;
  spec_limit: string;
  cpk: number | null;
  capable: boolean;
  violations: number;
  bell_curve: BellCurvePoint[];
}

export interface SpcSummary {
  capable: boolean;
  groups: SpcGroup[];
  worst_group: string | null;
  alerts: string[];
}

export interface FollowUpPlan {
  plan_id: string;
  gate: number;
  input_a: number;
  input_b: number;
  expected_state: "HIGH" | "LOW";
  sample_count: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  target_metric: string;
  rationale: string;
}

export interface AnomalyHighlight {
  test_id: string;
  message: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface AnalysisResult {
  overall_result: "PASS" | "FAIL";
  total_tests: number;
  passed: number;
  failed: number;
  failures: AnalysisFailure[];
  summary: string;
  spc_summary: SpcSummary;
  follow_up_plan: FollowUpPlan[];
  anomaly_highlights: AnomalyHighlight[];
}

export interface FollowUpRun {
  plan_id: string;
  mode: VerificationMode;
  executed: boolean;
  rationale: string;
  summary: string;
  readings: ReadingItem[];
}

export interface BatchSummary {
  batch_id: string;
  seed: number;
  failure_count: number;
  failure_rate: number;
  gate_failure_rates: Record<string, number>;
  mean_voltage: number;
}

export interface BatchAnalysis {
  batch_count: number;
  batches: BatchSummary[];
  drift_detected: boolean;
  trend_summary: string;
  predicted_hotspot_gate: number | null;
  recommendation: string;
  gate_scores: Record<string, number>;
}

export interface ChatCitation {
  kind: string;
  reference: string;
  excerpt: string;
}

export interface ChatResponse {
  answer: string;
  citations: ChatCitation[];
}

interface ApiEnvelope<T> {
  status: "success" | "error";
  data: T;
  message: string;
}

interface StreamEnvelope {
  event: "reading" | "anomaly" | "complete";
  data: ReadingItem | AnomalyHighlight | { count: number };
}

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE?.trim() || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

function buildApiUrl(path: string): string {
  return new URL(path, `${API_BASE}/`).toString();
}

async function readJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), init);
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.status !== "success") {
    throw new Error(payload.message || `Request failed: ${path}`);
  }
  return payload.data;
}

export async function extractRequirements(file: File): Promise<{ requirements: RequirementItem[]; conflicts: RequirementConflict[] }> {
  return readJson<{ requirements: RequirementItem[]; conflicts: RequirementConflict[] }>("/api/extract-requirements", {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: await file.arrayBuffer(),
  });
}

export async function generateTestPlan(requirements: RequirementItem[]): Promise<TestPlanItem[]> {
  const data = await readJson<{ test_plan: TestPlanItem[] }>("/api/generate-test-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirements }),
  });
  return data.test_plan;
}

export async function generateScript(testPlan: TestPlanItem[]): Promise<string> {
  const data = await readJson<{ script: string }>("/api/generate-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test_plan: testPlan }),
  });
  return data.script;
}

export async function flashArduino(script: string): Promise<void> {
  await readJson<{ status: string; message: string }>("/api/flash-arduino", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });
}

export async function runHardware(expectedCount = 16): Promise<ReadingItem[]> {
  const data = await readJson<{ readings: ReadingItem[] }>("/api/run-hardware", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expected_count: expectedCount }),
  });
  return data.readings;
}

export async function runSimulation(testPlan: TestPlanItem[]): Promise<ReadingItem[]> {
  const data = await readJson<{ readings: ReadingItem[] }>("/api/run-simulation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test_plan: testPlan }),
  });
  return data.readings;
}

export async function streamExecution(
  mode: VerificationMode,
  testPlan: TestPlanItem[],
  expectedCount: number,
  handlers: {
    onReading?: (reading: ReadingItem) => void;
    onAnomaly?: (anomaly: AnomalyHighlight) => void;
    onComplete?: (count: number) => void;
  },
): Promise<ReadingItem[]> {
  const response = await fetch(buildApiUrl("/api/stream-execution"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, test_plan: testPlan, expected_count: expectedCount }),
  });
  if (!response.ok || !response.body) {
    throw new Error("Execution stream could not be started.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const readings: ReadingItem[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        const payload = JSON.parse(line) as StreamEnvelope;
        if (payload.event === "reading") {
          const reading = payload.data as ReadingItem;
          readings.push(reading);
          handlers.onReading?.(reading);
        } else if (payload.event === "anomaly") {
          handlers.onAnomaly?.(payload.data as AnomalyHighlight);
        } else {
          handlers.onComplete?.((payload.data as { count: number }).count);
        }
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }

  return readings;
}

export async function analyseResults(readings: ReadingItem[], testPlan: TestPlanItem[]): Promise<AnalysisResult> {
  const data = await readJson<{ analysis: AnalysisResult }>("/api/analyse-results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ readings, test_plan: testPlan }),
  });
  return data.analysis;
}

export async function runFollowUp(
  mode: VerificationMode,
  testPlan: TestPlanItem[],
  followUpPlan: FollowUpPlan[],
): Promise<{ runs: FollowUpRun[]; summary: string }> {
  return readJson<{ runs: FollowUpRun[]; summary: string }>("/api/run-follow-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, test_plan: testPlan, follow_up_plan: followUpPlan }),
  });
}

export async function runBatchAnalysis(testPlan: TestPlanItem[], batchCount = 5): Promise<BatchAnalysis> {
  const data = await readJson<{ batch_analysis: BatchAnalysis }>("/api/run-batch-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test_plan: testPlan, batch_count: batchCount }),
  });
  return data.batch_analysis;
}

export async function askResultsQuestion(
  question: string,
  analysis: AnalysisResult,
  readings: ReadingItem[],
  requirements: RequirementItem[],
  testPlan: TestPlanItem[],
  batchAnalysis: BatchAnalysis | null,
): Promise<ChatResponse> {
  const data = await readJson<{ response: ChatResponse }>("/api/ask-results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      analysis,
      readings,
      requirements,
      test_plan: testPlan,
      batch_analysis: batchAnalysis,
    }),
  });
  return data.response;
}

export async function generateReport(
  analysis: AnalysisResult,
  requirements: RequirementItem[],
  testPlan: TestPlanItem[],
  extras: {
    conflicts: RequirementConflict[];
    batchAnalysis: BatchAnalysis | null;
    followUpRuns: FollowUpRun[];
  },
): Promise<Blob> {
  const response = await fetch(buildApiUrl("/api/generate-report"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      analysis,
      requirements,
      test_plan: testPlan,
      conflicts: extras.conflicts,
      batch_analysis: extras.batchAnalysis,
      follow_up_runs: extras.followUpRuns,
    }),
  });
  if (!response.ok) {
    const payload = (await response.json()) as ApiEnvelope<Record<string, never>>;
    throw new Error(payload.message || "Report generation failed");
  }
  return response.blob();
}
