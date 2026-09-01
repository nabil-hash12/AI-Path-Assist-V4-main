"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import StatusChip from "@/components/StatusChip";
import NewPatientModal from "@/components/NewPatientModal";
import { usePatients } from "@/lib/patients-context";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { AnalysisResult } from "@/lib/types";
import { buildCSV, downloadCSV, exportTimestamp, summarizeMetrics } from "@/lib/csv";

const UPLOAD_STYLES: Record<string, string> = {
  Uploaded: "bg-primary/10 text-primary",
  Processing: "bg-tertiary/10 text-tertiary",
  Processed: "bg-secondary/10 text-secondary",
};

export default function PatientsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { patients } = usePatients();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isLabTech = user?.role === "lab_tech";

  const filtered = patients.filter(
    (c) =>
      c.patientId.toLowerCase().includes(query.toLowerCase()) ||
      c.patientName.toLowerCase().includes(query.toLowerCase()) ||
      c.specimenType.toLowerCase().includes(query.toLowerCase())
  );

  // Export the currently filtered patient registry, joined with each
  // patient's latest AI analysis, as a single CSV file.
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const analyses = await Promise.all(
        filtered.map((c) =>
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
        "Report Approved",
        "Date Added",
        "AI Engine Version",
        "AI Analysis Date",
        "AI Analysis Summary",
        "Detected Biomarkers",
      ];

      const rows = filtered.map((c, i) => {
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
          c.reportApproved ? "Yes" : "No",
          c.dateAdded,
          a?.engineVersion ?? "",
          a?.createdAt ?? "",
          summarizeMetrics(a?.metrics),
          a?.tags?.join("; ") ?? "",
        ];
      });

      downloadCSV(`patient-registry_${exportTimestamp()}.csv`, buildCSV(headers, rows));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell allow={["admin", "pathologist", "lab_tech"]}>
      <TopBar title="Patient Registry" showSearch={false} showExport={!isLabTech} onExport={handleExport} exporting={exporting} />
      <main className="flex-grow p-xl overflow-y-auto">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-lg">
          <div className="flex items-center justify-between gap-md flex-wrap">
            <div className="relative w-full max-w-sm">
              <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" style={{ fontSize: 18 }}>search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-DEFAULT py-sm pl-xl pr-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                placeholder="Search by name, patient ID, or specimen type…"
              />
            </div>
            <div className="flex items-center gap-md">
              <span className="text-on-surface-variant text-sm font-data-mono">{filtered.length} records</span>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1 text-sm bg-primary text-on-primary rounded-DEFAULT px-md py-sm font-medium hover:bg-primary-fixed transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                New Patient
              </button>
            </div>
          </div>

          <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-label-caps uppercase tracking-wider">
                    <th className="p-md font-medium">Patient ID</th>
                    <th className="p-md font-medium">Name</th>
                    <th className="p-md font-medium">Age / Gender</th>
                    {isLabTech ? (
                      <th className="p-md font-medium">Upload Status</th>
                    ) : (
                      <>
                        <th className="p-md font-medium">Specimen Type</th>
                        <th className="p-md font-medium">Assigned Pathologist</th>
                        <th className="p-md font-medium">Status</th>
                      </>
                    )}
                    <th className="p-md font-medium">Date Added</th>
                  </tr>
                </thead>
                <tbody className="font-body-md">
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/patients/${c.id}`)}
                      className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <td className="p-md font-data-mono">{c.patientId}</td>
                      <td className="p-md text-on-surface font-medium">{c.patientName}</td>
                      <td className="p-md text-on-surface-variant">{c.age} · {c.gender}</td>
                      {isLabTech ? (
                        <td className="p-md">
                          <span className={`text-xs font-data-mono px-2 py-1 rounded ${UPLOAD_STYLES[c.uploadStatus] ?? "bg-surface-variant text-on-surface-variant"}`}>
                            {c.uploadStatus}
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="p-md">{c.specimenType}</td>
                          <td className="p-md text-on-surface-variant">{c.assignedTo ?? "Unassigned"}</td>
                          <td className="p-md"><StatusChip status={c.status} /></td>
                        </>
                      )}
                      <td className="p-md text-on-surface-variant">{c.dateAdded}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-lg text-center text-on-surface-variant">No patient records match your search.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <NewPatientModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={(id) => router.push(`/patients/${id}`)} />
    </AppShell>
  );
}
