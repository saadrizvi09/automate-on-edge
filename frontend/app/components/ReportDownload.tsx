interface ReportDownloadProps {
  reportUrl: string | null;
  busy: boolean;
}

export function ReportDownload({ reportUrl, busy }: ReportDownloadProps) {
  return (
    <section className="panel stack">
      <div className="eyebrow">Report package</div>
      <h2 style={{ margin: 0 }}>Verification report</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        The generated PDF includes the cover page, requirements table, test results, failure analysis, and sign-off section.
      </p>
      <div className="report-row">
        {reportUrl ? (
          <a className="download-btn" download="dvp_report.pdf" href={reportUrl}>
            Download verification report
          </a>
        ) : (
          <button className="mode-pill ghost-btn" disabled type="button">
            {busy ? "Preparing report..." : "Report not ready"}
          </button>
        )}
      </div>
    </section>
  );
}

