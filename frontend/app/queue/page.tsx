"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import Toggle from "@/components/Toggle";
import NewPatientModal from "@/components/NewPatientModal";
import { usePatients } from "@/lib/patients-context";
import { useSocket } from "@/lib/socket-context";
import { api, ApiError } from "@/lib/api";
import { AnalysisResult, QueueJob } from "@/lib/types";
import PatientSelect from "@/components/PatientSelect";
import { buildCSV, downloadCSV, exportTimestamp, summarizeMetrics } from "@/lib/csv";

interface PendingFile {
  file: File;
  patientId: string | null;
  assigned: boolean;
  error?: string;
}

interface HistoryItem {
  id: string;
  fileName: string;
  detail: string;
  state: "done" | "error";
  caseId: string | null;
}

export default function QueuePage() {
  const { patients, refresh } = usePatients();
  const { onJobProgress, onJobDone, connected } = useSocket();
  const [emailToggle, setEmailToggle] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [activeJobs, setActiveJobs] = useState<QueueJob[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const [active, hist] = await Promise.all([
        api.get<{ jobs: QueueJob[] }>("/api/queue/active"),
        api.get<{ history: HistoryItem[] }>("/api/queue/history"),
      ]);
      setActiveJobs(active.jobs);
      setHistory(hist.history);
    } catch {
      // silently retry on next tick
    }
  }, []);

  useEffect(() => {
    loadQueue();
    // Poll every 10s as a fallback if Socket.IO is disconnected.
    pollRef.current = setInterval(loadQueue, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadQueue]);

  // Real-time job progress via Socket.IO — update the matching job in state
  // directly without a round-trip fetch.
  useEffect(() => {
    const off = onJobProgress((e) => {
      setActiveJobs((prev) => {
        const exists = prev.some((j) => j.id === e.jobId);
        if (exists) {
          return prev.map((j) =>
            j.id === e.jobId ? { ...j, progress: e.progress, status: e.status as any, eta: e.eta } : j
          );
        }
        // New job we don't know about yet — do a full refresh.
        loadQueue();
        return prev;
      });
    });
    return off;
  }, [onJobProgress, loadQueue]);

  // When a job finishes (done or failed), refresh the full queue state.
  useEffect(() => {
    const off = onJobDone(() => { loadQueue(); refresh(); });
    return off;
  }, [onJobDone, loadQueue, refresh]);

  const addFiles = (incoming: File[]) => {
    setFiles((prev) => [...incoming.map((file) => ({ file, patientId: null, assigned: false })), ...prev]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) addFiles(dropped);
  }, []);

  const setFilePatient = (index: number, patientId: string) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, patientId } : f)));
  };

  const assignFile = async (index: number) => {
    const entry = files[index];
    if (!entry.patientId) return;
    try {
      const formData = new FormData();
      formData.append("file", entry.file);
      await api.upload(`/api/cases/${entry.patientId}/images`, formData);
      setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, assigned: true, error: undefined } : f)));
      loadQueue();
      refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Upload failed.";
      setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, error: message } : f)));
    }
  };

  // Export every patient currently in the registry, joined with each
  // patient's latest AI analysis, as a single CSV file.
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const analyses = await Promise.all(
        patients.map((c) =>
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
        "Upload Status",
        "Date Added",
        "AI Engine Version",
        "AI Analysis Date",
        "AI Analysis Summary",
        "Detected Biomarkers",
      ];

      const rows = patients.map((c, i) => {
        const a = analyses[i];
        return [
          c.patientId,
          c.patientName,
          c.age,
          c.gender,
          c.specimenType,
          c.assignedTo ?? "Unassigned",
          c.status,
          c.uploadStatus,
          c.dateAdded,
          a?.engineVersion ?? "",
          a?.createdAt ?? "",
          summarizeMetrics(a?.metrics),
          a?.tags?.join("; ") ?? "",
        ];
      });

      downloadCSV(`batch-queue-patients_${exportTimestamp()}.csv`, buildCSV(headers, rows));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell allow={["admin", "pathologist", "lab_tech"]}>
      <TopBar
        title="Batch Processing Queue"
        onExport={handleExport}
        exporting={exporting}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search by slide file name..."
      />
      <main className="flex-grow p-xl overflow-y-auto">
        <div className="grid grid-cols-12 gap-lg max-w-[1600px] mx-auto">
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-lg">
            <section className="bg-surface-container-lowest border border-surface-container-highest rounded-lg p-md flex flex-col gap-md">
              <div className="flex justify-between items-center">
                <h2 className="font-headline-sm flex items-center gap-xs">
                  <span className="material-symbols-outlined text-primary">cloud_upload</span>
                  Secure Batch Upload
                </h2>
                <div className="flex items-center gap-xs">
                  <span className="font-label-caps text-on-surface-variant border border-outline-variant rounded px-xs py-[2px]">PNG</span>
                  <span className="font-label-caps text-on-surface-variant border border-outline-variant rounded px-xs py-[2px]">TIFF</span>
                </div>
              </div>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-xl flex flex-col items-center justify-center text-center bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer group ${dragActive ? "border-primary bg-surface-container" : "border-outline-variant"
                  }`}
              >
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/tiff,image/webp,image/bmp"
                  className="hidden"
                  onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                />
                <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center mb-md group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary" style={{ fontSize: 24 }}>upload_file</span>
                </div>
                <h3 className="font-body-lg text-on-surface font-medium mb-xs">Drag and drop slide files here</h3>
                <p className="font-body-md text-on-surface-variant mb-md">PNG, JPEG, TIFF, WEBP, BMP · up to 200MB per file.</p>
                <span className="border border-outline-variant text-on-surface px-md py-sm rounded hover:bg-surface-container-highest transition-colors font-medium inline-block">
                  Browse Files
                </span>
              </label>
              {files.length > 0 && (
                <div className="flex flex-col gap-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-label-caps text-on-surface-variant">Assign Scans to Patients</h3>
                    <button
                      onClick={() => setNewPatientOpen(true)}
                      className="text-primary text-xs font-medium hover:text-primary-fixed flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person_add</span>
                      New Patient
                    </button>
                  </div>
                  <ul className="flex flex-col gap-sm">
                    {files.map((f, i) => (
                      <li key={i} className="flex flex-col gap-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-sm bg-surface-container-low border border-outline-variant rounded-DEFAULT p-sm">
                          <span className="flex items-center gap-2 font-data-mono text-sm text-on-surface flex-grow">
                            <span className={`material-symbols-outlined ${f.assigned ? "text-secondary" : "text-on-surface-variant"}`} style={{ fontSize: 16 }}>
                              {f.assigned ? "check_circle" : "image"}
                            </span>
                            {f.file.name}
                          </span>

                          <PatientSelect
                            value={f.patientId}
                            onChange={(id) => setFilePatient(i, id)}
                            patients={patients}
                            disabled={f.assigned}
                            placeholder="Select patient…"
                          />
                          <button
                            onClick={() => assignFile(i)}
                            disabled={!f.patientId || f.assigned}
                            className="text-xs font-medium px-3 py-1 rounded bg-primary text-on-primary hover:bg-primary-fixed transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {f.assigned ? "Assigned" : "Assign"}
                          </button>
                        </div>
                        {f.error && <p className="text-error text-xs pl-sm">{f.error}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="bg-surface-container-lowest border border-surface-container-highest rounded-lg overflow-hidden flex flex-col">
              <div className="flex justify-between items-center bg-surface-container-low">
                <h2 className="font-headline-sm flex items-center gap-xs">
                  <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>autorenew</span>
                  Active Processing Queue
                </h2>
                <div className="flex items-center gap-sm">
                  <span className={`flex h-2 w-2 rounded-full ${connected ? "bg-secondary animate-pulse" : "bg-outline-variant"}`} title={connected ? "Real-time connected" : "Polling fallback"} />
                  <span className="font-data-mono text-on-surface-variant bg-surface-container px-sm py-xs rounded">{activeJobs.filter((j) => j.status === "active").length} Active</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container-low font-label-caps text-on-surface-variant uppercase tracking-wider">
                      <th className="p-md font-medium">Slide ID</th>
                      <th className="p-md font-medium">Framework</th>
                      <th className="p-md font-medium w-1/3">Progress</th>
                      <th className="p-md font-medium text-right">Time Remaining</th>
                      <th className="p-md font-medium text-center">Case</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-md">
                    {activeJobs.filter((j) => j.fileName.toLowerCase().includes(query.toLowerCase())).length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-md text-center text-on-surface-variant text-sm">
                          {query ? "No active jobs match your search." : "No active jobs. Upload a slide to start AI inference."}
                        </td>
                      </tr>
                    )}
                    {activeJobs
                      .filter((j) => j.fileName.toLowerCase().includes(query.toLowerCase()))
                      .map((job) => (
                      <tr key={job.id} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors">
                        <td className="p-md font-data-mono flex items-center gap-sm">
                          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>image</span>
                          {job.fileName}
                        </td>
                        <td className="p-md">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-surface-container border border-outline-variant text-on-surface">
                            {job.framework}
                          </span>
                        </td>
                        <td className="p-md">
                          <div className="flex items-center gap-sm">
                            <div className="flex-grow h-2 bg-surface-container-highest rounded-full overflow-hidden">
                              <div
                                className={`h-full ${job.status === "active" ? "bg-primary progress-bar-stripe" : "bg-surface-variant"}`}
                                style={{ width: job.status === "active" ? `${job.progress}%` : "100%" }}
                              />
                            </div>
                            <span className="font-data-mono text-primary min-w-[3ch]">{job.status === "active" ? `${job.progress}%` : "Q'd"}</span>
                          </div>
                        </td>
                        <td className="p-md text-right font-data-mono text-on-surface-variant">{job.eta}</td>
                        <td className="p-md text-center font-data-mono text-on-surface-variant text-xs">{job.caseId ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-lg">
            <section className="bg-surface-container-lowest border border-surface-container-highest rounded-lg p-md">
              <h2 className="font-headline-sm mb-md flex items-center gap-xs border-b border-outline-variant pb-sm">
                <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
                Queue Settings
              </h2>
              <div className="flex items-center justify-between py-sm">
                <div className="flex flex-col">
                  <span className="font-body-md font-medium text-on-surface">Email upon completion</span>
                  <span className="text-on-surface-variant text-xs">Notify tech@lab.local</span>
                </div>
                <Toggle id="email-toggle" checked={emailToggle} onChange={setEmailToggle} />
              </div>
            </section>

            <section className="bg-surface-container-lowest border border-surface-container-highest rounded-lg flex flex-col flex-grow">
              <div className="p-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                <h2 className="font-headline-sm flex items-center gap-xs">
                  <span className="material-symbols-outlined text-secondary">history</span>
                  Recent Activity
                </h2>
              </div>
              <ul className="flex flex-col max-h-[400px] overflow-y-auto">
                {history.filter((h) => h.fileName.toLowerCase().includes(query.toLowerCase())).length === 0 && (
                  <li className="p-md text-center text-on-surface-variant text-sm">
                    {query ? "No history items match your search." : "No completed jobs yet."}
                  </li>
                )}
                {history
                  .filter((h) => h.fileName.toLowerCase().includes(query.toLowerCase()))
                  .map((h) => (
                  <li key={h.id} className="p-md border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors flex justify-between items-center">
                    <div className="flex flex-col gap-xs">
                      <span className="font-data-mono text-on-surface flex items-center gap-xs">
                        <span className={`material-symbols-outlined ${h.state === "done" ? "text-secondary" : "text-error"}`} style={{ fontSize: 16 }}>
                          {h.state === "done" ? "check_circle" : "error"}
                        </span>
                        {h.fileName}
                      </span>
                      <span className={`font-label-caps ${h.state === "error" ? "text-error" : "text-on-surface-variant"}`}>{h.detail}</span>
                    </div>
                    {h.state === "done" && h.caseId && (
                      <a href={`/analysis/${h.caseId}`} className="text-primary hover:text-primary-container text-sm border border-primary/30 rounded px-2 py-1 transition-colors">View</a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
      <NewPatientModal open={newPatientOpen} onClose={() => setNewPatientOpen(false)} />
    </AppShell>
  );
}
