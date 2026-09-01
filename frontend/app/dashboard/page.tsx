"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import MetricCard from "@/components/MetricCard";
import StatusChip from "@/components/StatusChip";
import { usePatients } from "@/lib/patients-context";
import { api } from "@/lib/api";
import { ActivityItem, AnalysisResult } from "@/lib/types";
import { buildCSV, downloadCSV, exportTimestamp, summarizeMetrics } from "@/lib/csv";

interface Stats {
  activeCases: number;
  totalCases: number;
  pendingReviews: number;
  avgInferenceSeconds: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { patients } = usePatients();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState("");

  const filteredPatients = patients.filter(
    (c) =>
      c.patientId.toLowerCase().includes(query.toLowerCase()) ||
      c.patientName.toLowerCase().includes(query.toLowerCase()) ||
      c.specimenType.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    api.get<Stats>("/api/dashboard/stats").then(setStats).catch(() => {});
    api.get<{ activity: ActivityItem[] }>("/api/dashboard/activity").then((r) => setActivity(r.activity)).catch(() => {});
  }, []);

  // Export every visible patient case, joined with each patient's latest
  // AI analysis, as a single CSV file.
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const analyses = await Promise.all(
        filteredPatients.map((c) =>
          api
            .get<{ analysis: AnalysisResult }>(`/api/cases/${c.id}/analysis`)
            .then((res) => res.analysis)
            .catch(() => null)
        )
      );

      const headers = [
        "Patient ID",
        "Patient Name",
        "Age",
        "Gender",
        "Specimen Type",
        "Assigned Pathologist",
        "Status",
        "Diagnosis Status",
        "Upload Status",
        "Date Added",
        "AI Engine Version",
        "AI Analysis Date",
        "AI Analysis Summary",
        "Detected Biomarkers",
      ];

      const rows = filteredPatients.map((c, i) => {
        const a = analyses[i];
        return [
          c.patientId,
          c.patientName,
          c.age,
          c.gender,
          c.specimenType,
          c.assignedTo ?? "Unassigned",
          c.status,
          c.diagnosisStatus,
          c.uploadStatus,
          c.dateAdded,
          a?.engineVersion ?? "",
          a?.createdAt ?? "",
          summarizeMetrics(a?.metrics),
          a?.tags?.join("; ") ?? "",
        ];
      });

      downloadCSV(`clinical-overview_${exportTimestamp()}.csv`, buildCSV(headers, rows));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell allow={["admin", "pathologist", "researcher"]}>
      <TopBar
        title="Clinical Overview"
        onExport={handleExport}
        exporting={exporting}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search patient ID, name, or specimen..."
      />
      <main className="flex-grow p-xl overflow-y-auto">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-on-surface-variant">Real-time status of pathological analyses.</p>
            </div>
            <div className="flex items-center gap-2 bg-surface-container border border-surface-container-highest rounded-DEFAULT px-md py-sm font-data-mono text-sm text-on-surface-variant">
              System Status:
              <span className="inline-flex items-center gap-1 text-secondary">
                <span className="w-2 h-2 rounded-full bg-secondary inline-block" /> Operational
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            <MetricCard label="Active Cases" value={stats ? stats.activeCases : "—"} icon="folder_open" footnote={stats ? `${stats.totalCases} total cases` : ""} tone="secondary" />
            <MetricCard label="Pending Reviews" value={stats ? stats.pendingReviews : "—"} icon="assignment_late" footnote={stats && stats.pendingReviews > 0 ? "! Requires attention" : "All caught up"} tone="error" />
            <MetricCard
              label="Avg. Inference Time"
              value={<span>{stats ? stats.avgInferenceSeconds : "—"}<span className="text-base font-normal text-on-surface-variant"> sec</span></span>}
              icon="timer"
              footnote="From recent completed jobs"
              tone="neutral"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
            <section className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-surface-container-highest overflow-hidden">
              <div className="flex justify-between items-center p-lg border-b border-outline-variant">
                <h2 className="font-headline-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">receipt_long</span>
                  Patient Registry
                </h2>
                <button
                  onClick={() => router.push("/patients")}
                  className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface border border-outline-variant rounded px-2 py-1 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                  Full Registry
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-label-caps uppercase tracking-wider">
                      <th className="p-md font-medium">Patient ID</th>
                      <th className="p-md font-medium">Specimen Type</th>
                      <th className="p-md font-medium">Date Added</th>
                      <th className="p-md font-medium">Processing Status</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-md">
                    {filteredPatients.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors cursor-pointer"
                        onClick={() => router.push(`/analysis/${c.id}`)}
                      >
                        <td className="p-md font-data-mono">{c.patientId}</td>
                        <td className="p-md">{c.specimenType}</td>
                        <td className="p-md text-on-surface-variant">{c.dateAdded}</td>
                        <td className="p-md"><StatusChip status={c.status} /></td>
                      </tr>
                    ))}
                    {filteredPatients.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-lg text-center text-on-surface-variant">No cases match your search.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest overflow-hidden flex flex-col">
              <div className="p-lg border-b border-outline-variant">
                <h2 className="font-headline-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">history</span>
                  System Activity
                </h2>
              </div>
              <ul className="flex flex-col p-lg gap-lg overflow-y-auto">
                {activity.length === 0 && <li className="text-on-surface-variant text-sm">No recent activity.</li>}
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span
                      className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        a.tone === "primary" ? "bg-primary" : a.tone === "secondary" ? "bg-secondary" : a.tone === "error" ? "bg-error" : "bg-outline-variant"
                      }`}
                    />
                    <div>
                      <p className="font-medium text-on-surface">{a.title}</p>
                      <p className="text-on-surface-variant text-sm">{a.detail}</p>
                      <p className="text-outline text-xs font-data-mono mt-1">{a.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </AppShell>
  );
}
