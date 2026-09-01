"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import Modal from "@/components/Modal";
import { api, fileUrl } from "@/lib/api";
import { AnalysisResult } from "@/lib/types";
import { buildCSV, downloadCSV, exportTimestamp, summarizeMetrics } from "@/lib/csv";

interface ReportRow {
  id: string;
  caseId: string;
  patientId: string;
  signedBy: string;
  date: string;
  status: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [viewing, setViewing] = useState<ReportRow | null>(null);

  useEffect(() => {
    api
      .get<{ reports: ReportRow[] }>("/api/reports")
      .then((res) => setReports(res.reports))
      .finally(() => setLoading(false));
  }, []);

  // Export the signed reports list, joined with each case's latest AI
  // analysis, as a single CSV file.
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const analyses = await Promise.all(
        reports.map((r) =>
          api
            .get<{ analysis: AnalysisResult }>(`/api/cases/${r.caseId}/analysis`)
            .then((res) => res.analysis)
            .catch(() => null)
        )
      );

      const headers = [
        "Report ID",
        "Case ID",
        "Patient ID",
        "Signed By",
        "Date",
        "Diagnosis Status",
        "AI Engine Version",
        "AI Analysis Date",
        "AI Analysis Summary",
        "Detected Biomarkers",
      ];

      const rows = reports.map((r, i) => {
        const a = analyses[i];
        return [
          r.id,
          r.caseId,
          r.patientId,
          r.signedBy,
          r.date,
          r.status,
          a?.engineVersion ?? "",
          a?.createdAt ?? "",
          summarizeMetrics(a?.metrics),
          a?.tags?.join("; ") ?? "",
        ];
      });

      downloadCSV(`diagnostic-reports_${exportTimestamp()}.csv`, buildCSV(headers, rows));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell allow={["admin", "pathologist"]}>
      <TopBar title="Diagnostic Reports" showSearch={false} onExport={handleExport} exporting={exporting} />
      <main className="flex-grow p-xl overflow-y-auto">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-lg">
          <p className="text-on-surface-variant">Signed reports generated from the AI inference viewer.</p>
          <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant font-label-caps uppercase tracking-wider">
                  <th className="p-md font-medium">Report ID</th>
                  <th className="p-md font-medium">Case</th>
                  <th className="p-md font-medium">Signed By</th>
                  <th className="p-md font-medium">Date</th>
                  <th className="p-md font-medium">Status</th>
                  <th className="p-md font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="font-body-md">
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors">
                    <td className="p-md font-data-mono text-primary">{r.id}</td>
                    <td className="p-md font-data-mono">{r.caseId} · {r.patientId}</td>
                    <td className="p-md text-on-surface-variant">{r.signedBy}</td>
                    <td className="p-md text-on-surface-variant">{r.date}</td>
                    <td className="p-md">
                      <span className="text-xs font-data-mono px-2 py-1 rounded bg-secondary/10 text-secondary">{r.status}</span>
                    </td>
                    <td className="p-md text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setViewing(r)}
                          className="text-primary hover:text-primary-container text-sm border border-primary/30 rounded px-2 py-1 transition-colors flex items-center gap-1 w-fit"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                          View
                        </button>
                        <a
                          href={fileUrl(`/files/reports/${r.id}.pdf`)}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:text-primary-container text-sm border border-primary/30 rounded px-2 py-1 transition-colors flex items-center gap-1 w-fit"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && reports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-lg text-center text-on-surface-variant">No signed reports yet. Generate one from the AI Inference Viewer.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </main>
      <Footer />

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Report ${viewing.id} · ${viewing.caseId}` : "Report"}
        icon="description"
        widthClass="max-w-4xl"
        bodyClassName="p-0"
      >
        {viewing && (
          <div style={{ height: "min(75dvh, calc(90dvh - 57px))" }} className="flex flex-col">
            <div className="flex items-center justify-between px-lg py-sm border-b border-outline-variant text-sm text-on-surface-variant shrink-0" style={{ height: 48 }}>
              <span>
                {viewing.patientId} · Signed by {viewing.signedBy} · {viewing.date}
              </span>
              <a
                href={fileUrl(`/files/reports/${viewing.id}.pdf`)}
                download
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:text-primary-container flex items-center gap-1"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                Download
              </a>
            </div>
            <iframe
              key={viewing.id}
              src={fileUrl(`/files/reports/${viewing.id}.pdf`)}
              title={`Report ${viewing.id}`}
              style={{ display: "block", width: "100%", height: "calc(min(75dvh, calc(90dvh - 57px)) - 48px)", border: "none" }}
            />
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
