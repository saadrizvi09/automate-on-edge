import type { TestPlanItem } from "../lib/api";

interface TestPlanTableProps {
  testPlan: TestPlanItem[];
}

export function TestPlanTable({ testPlan }: TestPlanTableProps) {
  return (
    <section className="panel stack">
      <div className="eyebrow">Stage 3 output</div>
      <h2 style={{ margin: 0 }}>Generated test plan</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Test ID</th>
              <th>Requirement</th>
              <th>Name</th>
              <th>Steps</th>
              <th>Expected</th>
            </tr>
          </thead>
          <tbody>
            {testPlan.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">No test plan generated yet.</td>
              </tr>
            ) : (
              testPlan.map((item) => (
                <tr key={item.test_id}>
                  <td>{item.test_id}</td>
                  <td>{item.requirement_id}</td>
                  <td>{item.test_name}</td>
                  <td>{item.steps.join(" -> ")}</td>
                  <td>{item.expected_result}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
