import type { RequirementItem } from "../lib/api";

interface RequirementsTableProps {
  requirements: RequirementItem[];
}

export function RequirementsTable({ requirements }: RequirementsTableProps) {
  return (
    <section className="panel stack">
      <div className="eyebrow">Stage 2 output</div>
      <h2 style={{ margin: 0 }}>Extracted requirements</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Description</th>
              <th>Acceptance criteria</th>
              <th>Test method</th>
            </tr>
          </thead>
          <tbody>
            {requirements.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">No requirements extracted yet.</td>
              </tr>
            ) : (
              requirements.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.description}</td>
                  <td>{item.acceptance_criteria}</td>
                  <td>{item.test_method}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
