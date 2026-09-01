"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import StatusChip from "@/components/StatusChip";
import { usePatients } from "@/lib/patients-context";
import { useAuth } from "@/lib/auth-context";
import { AnalysisResult, Gender, UploadStatus, BiomarkerMetric } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { buildCSV, downloadCSV, exportTimestamp } from "@/lib/csv";

const UPLOAD_STEPS: UploadStatus[] = ["Uploaded", "Processing", "Processed"];

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { getById, updateBasicInfo, updateCaseRecord, uploadScans, setUploadStatus, addNote, fetchById, approveReport, removePatient } = usePatients();
  const c = getById(params.id);
  const isLabTech = user?.role === "lab_tech";
  const isAdmin = user?.role === "admin";
  const canApproveReport = user?.role === "admin" || user?.role === "pathologist";
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [editingBasic, setEditingBasic] = useState(false);
  const [basicForm, setBasicForm] = useState({ patientName: c?.patientName ?? "", age: String(c?.age ?? ""), gender: (c?.gender ?? "Female") as Gender });
  const [caseForm, setCaseForm] = useState({ specimenType: c?.specimenType ?? "", assignedTo: c?.assignedTo ?? "" });
  const [editingCase, setEditingCase] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    fetchById(params.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const [metrics, setMetrics] = useState<BiomarkerMetric[]>([]);
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ analysis: { metrics: BiomarkerMetric[] } }>(`/api/cases/${params.id}/analysis`)
      .then((res) => {
        if (!cancelled) setMetrics(res.analysis.metrics);
      })
      .catch(() => {
        if (!cancelled) setMetrics([]);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, c?.uploadStatus]);

  if (!c) {
    return (
      <AppShell allow={["admin", "pathologist", "lab_tech"]}>
        <TopBar title="Patient" showExport={false} showSearch={false} />
        <main className="flex-grow p-xl">
          <div className="max-w-[800px] mx-auto bg-surface-container-lowest border border-surface-container-highest rounded-xl p-xl text-center text-on-surface-variant">
            Case not found.
          </div>
        </main>
        <Footer />
      </AppShell>
    );
  }

  const [exporting, setExporting] = useState(false);

  // Export this patient's info joined with every AI analysis run against
  // them (one row per detected biomarker) as a single CSV file.
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await api
        .get<{ analyses: AnalysisResult[] }>(`/api/cases/${c.id}/analyses`)
        .catch(() => ({ analyses: [] as AnalysisResult[] }));

      const headers = [
        "Patient ID",
        "Patient Name",
        "Age",
        "Gender",
        "Specimen Type",
        "Assigned Pathologist",
        "Status",
        "Diagnosis Status",
        "Date Added",
        "Analysis ID",
        "Analysis Date",
        "AI Engine Version",
        "Slide File Name",
        "Biomarker",
        "Value",
        "Unit",
        "Severity",
        "Confidence (%)",
        "Tag",
      ];

      const patientCols = [
        c.patientId,
        c.patientName,
        c.age,
        c.gender,
        c.specimenType,
        c.assignedTo ?? "Unassigned",
        c.status,
        c.diagnosisStatus,
        c.dateAdded,
      ];

      const rows: (string | number)[][] = [];
      if (res.analyses.length === 0) {
        rows.push([...patientCols, "", "", "", "", "", "", "", "", ""]);
      } else {
        for (const a of res.analyses) {
          if (a.metrics.length === 0) {
            rows.push([...patientCols, a.id, a.createdAt, a.engineVersion, a.fileName ?? "", "", "", "", "", "", ""]);
          } else {
            for (const m of a.metrics) {
              rows.push([
                ...patientCols,
                a.id,
                a.createdAt,
                a.engineVersion,
                a.fileName ?? "",
                m.label,
                m.value,
                m.unit ?? "",
                m.severity,
                m.confidence ?? "",
                m.tag,
              ]);
            }
          }
        }
      }

      downloadCSV(`patient-${c.patientId}_${exportTimestamp()}.csv`, buildCSV(headers, rows));
    } finally {
      setExporting(false);
    }
  };

  const saveBasicInfo = () => {
    const ageNum = Number(basicForm.age);
    updateBasicInfo(c.id, {
      patientName: basicForm.patientName.trim() || c.patientName,
      age: Number.isNaN(ageNum) ? c.age : ageNum,
      gender: basicForm.gender,
    });
    setEditingBasic(false);
  };

  const saveCaseRecord = () => {
    updateCaseRecord(c.id, { specimenType: caseForm.specimenType.trim() || c.specimenType, assignedTo: caseForm.assignedTo.trim() || undefined });
    setEditingCase(false);
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const names = Array.from(fileList).map((f) => f.name);
    setUploadError("");
    setUploading(true);
    try {
      await uploadScans(c.id, fileList);
      setUploadedFiles((prev) => [...names, ...prev]);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const advanceUploadStatus = () => {
    const idx = UPLOAD_STEPS.indexOf(c.uploadStatus);
    const next = UPLOAD_STEPS[Math.min(idx + 1, UPLOAD_STEPS.length - 1)];
    setUploadStatus(c.id, next);
  };

  const handleApproveReport = async () => {
    setApproveError("");
    setApproving(true);
    try {
      await approveReport(c.id);
    } catch (err) {
      setApproveError(err instanceof ApiError ? err.message : "Failed to approve report.");
    } finally {
      setApproving(false);
    }
  };

  const handleDeleteCase = async () => {
    if (!confirm(`Permanently delete the case for ${c.patientName} (${c.patientId})? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await removePatient(c.id);
      router.push("/patients");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete case.");
      setDeleting(false);
    }
  };

  return (
    <AppShell allow={["admin", "pathologist", "lab_tech"]}>
      <TopBar title={`Patient ${c.patientId}`} showExport={!isLabTech} onExport={handleExport} exporting={exporting} showSearch={false} />
      <main className="flex-grow p-xl overflow-y-auto">
        <div className="max-w-[1000px] mx-auto flex flex-col gap-lg">
          <button onClick={() => router.push("/patients")} className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface w-fit">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Back to Registry
          </button>

          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-lg flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div>
              <p className="font-data-mono text-primary text-sm mb-1">{c.id} · {c.patientId}</p>
              <h2 className="font-headline-md text-2xl font-semibold">{c.patientName}</h2>
              <p className="text-on-surface-variant">{c.age} yrs · {c.gender} · {c.specimenType}</p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <StatusChip status={c.status} />
              <span className="text-on-surface-variant text-sm font-data-mono">Added {c.dateAdded}</span>
              {!isLabTech && <span className="text-on-surface-variant text-sm">Assigned to {c.assignedTo ?? "Unassigned"}</span>}
            </div>
          </div>

          {isLabTech ? (
            <>
              {/* Edit basic info */}
              <section className="bg-surface-container rounded-xl border border-surface-container-highest p-lg flex flex-col gap-md">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-sm">Basic Info</h3>
                  {!editingBasic && (
                    <button onClick={() => setEditingBasic(true)} className="text-primary text-sm font-medium hover:text-primary-fixed flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                      Edit
                    </button>
                  )}
                </div>
                {editingBasic ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                    <label className="flex flex-col gap-1">
                      <span className="font-label-caps text-on-surface-variant">Name</span>
                      <input className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface" value={basicForm.patientName} onChange={(e) => setBasicForm((f) => ({ ...f, patientName: e.target.value }))} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-label-caps text-on-surface-variant">Age</span>
                      <input type="number" className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface" value={basicForm.age} onChange={(e) => setBasicForm((f) => ({ ...f, age: e.target.value }))} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-label-caps text-on-surface-variant">Gender</span>
                      <select className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface" value={basicForm.gender} onChange={(e) => setBasicForm((f) => ({ ...f, gender: e.target.value as Gender }))}>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                    <div className="md:col-span-3 flex gap-sm">
                      <button onClick={saveBasicInfo} className="bg-primary text-on-primary rounded-DEFAULT px-md py-sm text-sm font-medium hover:bg-primary-fixed transition-colors">Save</button>
                      <button onClick={() => setEditingBasic(false)} className="border border-outline-variant rounded-DEFAULT px-md py-sm text-sm text-on-surface hover:bg-surface-container-high transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-md text-sm">
                    <div><span className="text-on-surface-variant">Name</span><p className="text-on-surface font-medium">{c.patientName}</p></div>
                    <div><span className="text-on-surface-variant">Age</span><p className="text-on-surface font-medium">{c.age}</p></div>
                    <div><span className="text-on-surface-variant">Gender</span><p className="text-on-surface font-medium">{c.gender}</p></div>
                  </div>
                )}
              </section>

              {/* Create/update case record */}
              <section className="bg-surface-container rounded-xl border border-surface-container-highest p-lg flex flex-col gap-md">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-sm">Case Record</h3>
                  {!editingCase && (
                    <button onClick={() => setEditingCase(true)} className="text-primary text-sm font-medium hover:text-primary-fixed flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                      Update
                    </button>
                  )}
                </div>
                {editingCase ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                    <label className="flex flex-col gap-1">
                      <span className="font-label-caps text-on-surface-variant">Specimen Type</span>
                      <input className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface" value={caseForm.specimenType} onChange={(e) => setCaseForm((f) => ({ ...f, specimenType: e.target.value }))} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-label-caps text-on-surface-variant">Assigned Pathologist</span>
                      <input className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface" value={caseForm.assignedTo} onChange={(e) => setCaseForm((f) => ({ ...f, assignedTo: e.target.value }))} />
                    </label>
                    <div className="md:col-span-2 flex gap-sm">
                      <button onClick={saveCaseRecord} className="bg-primary text-on-primary rounded-DEFAULT px-md py-sm text-sm font-medium hover:bg-primary-fixed transition-colors">Save</button>
                      <button onClick={() => setEditingCase(false)} className="border border-outline-variant rounded-DEFAULT px-md py-sm text-sm text-on-surface hover:bg-surface-container-high transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-md text-sm">
                    <div><span className="text-on-surface-variant">Specimen Type</span><p className="text-on-surface font-medium">{c.specimenType}</p></div>
                    <div><span className="text-on-surface-variant">Assigned Pathologist</span><p className="text-on-surface font-medium">{c.assignedTo ?? "Unassigned"}</p></div>
                  </div>
                )}
              </section>

              {/* Upload images + assign scan */}
              <section className="bg-surface-container rounded-xl border border-surface-container-highest p-lg flex flex-col gap-md">
                <h3 className="font-headline-sm">Upload &amp; Assign Scans</h3>
                {uploadError && (
                  <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/10 px-3 py-2 text-sm text-error">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
                    {uploadError}
                  </div>
                )}
                <label className={`border-2 border-dashed border-outline-variant rounded-lg p-lg flex flex-col items-center justify-center text-center bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                  <input type="file" multiple accept="image/png,image/jpeg,image/tiff,image/webp,image/bmp" className="hidden" onChange={(e) => handleUpload(e.target.files)} disabled={uploading} />
                  <span className="material-symbols-outlined text-on-surface-variant mb-2" style={{ fontSize: 28 }}>{uploading ? "hourglass_top" : "upload_file"}</span>
                  <p className="text-on-surface font-medium">{uploading ? "Uploading & starting AI analysis…" : "Upload histopathology / scan images"}</p>
                  <p className="text-on-surface-variant text-sm">Automatically assigned to {c.patientId} on upload · PNG, JPEG, TIFF, WEBP, BMP</p>
                </label>
                {(uploadedFiles.length > 0) && (
                  <ul className="text-sm text-on-surface-variant font-data-mono flex flex-col gap-1">
                    {uploadedFiles.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>check_circle</span>
                        {f} — assigned to {c.patientId}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Upload status tracker */}
              <section className="bg-surface-container rounded-xl border border-surface-container-highest p-lg flex flex-col gap-md">
                <h3 className="font-headline-sm">Upload Status</h3>
                <div className="flex items-center gap-sm">
                  {UPLOAD_STEPS.map((step, i) => {
                    const currentIdx = UPLOAD_STEPS.indexOf(c.uploadStatus);
                    const reached = i <= currentIdx;
                    return (
                      <div key={step} className="flex items-center gap-sm flex-1">
                        <div className={`flex items-center gap-2 px-md py-sm rounded-DEFAULT border ${reached ? "border-primary text-primary bg-primary/10" : "border-outline-variant text-on-surface-variant"}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{reached ? "check_circle" : "radio_button_unchecked"}</span>
                          <span className="text-sm font-medium">{step}</span>
                        </div>
                        {i < UPLOAD_STEPS.length - 1 && <div className={`flex-1 h-px ${reached ? "bg-primary" : "bg-outline-variant"}`} />}
                      </div>
                    );
                  })}
                </div>
                {c.uploadStatus !== "Processed" && (
                  <button onClick={advanceUploadStatus} className="w-fit bg-primary text-on-primary rounded-DEFAULT px-md py-sm text-sm font-medium hover:bg-primary-fixed transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                    Mark as {UPLOAD_STEPS[UPLOAD_STEPS.indexOf(c.uploadStatus) + 1]}
                  </button>
                )}
              </section>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                <section className="bg-surface-container rounded-xl border border-surface-container-highest p-lg">
                  <h3 className="font-headline-sm mb-md">Latest Biomarker Panel</h3>
                  {metrics.length === 0 ? (
                    <p className="text-on-surface-variant text-sm">No AI analysis available yet. Upload a slide image to run inference.</p>
                  ) : (
                    <ul className="flex flex-col gap-sm">
                      {metrics.map((m) => (
                        <li key={m.key} className="flex justify-between border-b border-outline-variant py-2 last:border-0">
                          <span className="text-on-surface-variant">{m.label}</span>
                          <span className="font-data-mono text-on-surface">{m.value}{m.unit ? ` ${m.unit}` : ""}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="bg-surface-container rounded-xl border border-surface-container-highest p-lg flex flex-col gap-md">
                  <h3 className="font-headline-sm">Actions</h3>
                  <button
                    onClick={() => router.push(`/analysis/${c.id}`)}
                    className="w-full flex items-center justify-center gap-sm p-md rounded-DEFAULT bg-primary text-on-primary hover:bg-primary-container transition-colors font-medium"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span>
                    Open in AI Inference Viewer
                  </button>
                  <button
                    onClick={() => router.push("/reports")}
                    className="w-full flex items-center justify-center gap-sm p-md rounded-DEFAULT border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>description</span>
                    View Reports
                  </button>
                  <div className="text-xs text-on-surface-variant font-data-mono pt-sm border-t border-outline-variant">
                    Upload status: <span className="text-on-surface">{c.uploadStatus}</span>
                  </div>

                  {canApproveReport && (
                    <div className="pt-sm border-t border-outline-variant flex flex-col gap-sm">
                      {approveError && (
                        <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/10 px-3 py-2 text-xs text-error">
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
                          {approveError}
                        </div>
                      )}
                      {c.reportApproved ? (
                        <div className="flex items-center gap-2 text-sm text-secondary">
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>task_alt</span>
                          Diagnostic report approved
                        </div>
                      ) : (
                        <button
                          onClick={handleApproveReport}
                          disabled={approving}
                          className="w-full flex items-center justify-center gap-sm p-md rounded-DEFAULT border border-secondary text-secondary hover:bg-secondary/10 transition-colors font-medium disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>task_alt</span>
                          {approving ? "Approving…" : "Approve Diagnostic Report"}
                        </button>
                      )}
                    </div>
                  )}

                  {isAdmin && (
                    <button
                      onClick={handleDeleteCase}
                      disabled={deleting}
                      className="w-full flex items-center justify-center gap-sm p-md rounded-DEFAULT border border-error text-error hover:bg-error/10 transition-colors font-medium disabled:opacity-50 mt-sm"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                      {deleting ? "Deleting…" : "Delete Case"}
                    </button>
                  )}
                </section>
              </div>

              <section className="bg-surface-container rounded-xl border border-surface-container-highest p-lg flex flex-col gap-md">
                <h3 className="font-headline-sm">Case Notes</h3>
                <ul className="flex flex-col gap-sm">
                  {c.notes.length === 0 && <li className="text-on-surface-variant text-sm">No notes yet.</li>}
                  {c.notes.map((n) => (
                    <li key={n.id} className="border-b border-outline-variant pb-sm last:border-0">
                      <p className="text-on-surface text-sm">{n.text}</p>
                      <p className="text-on-surface-variant text-xs font-data-mono mt-1">{n.author} · {n.time}</p>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-sm">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a case note…"
                    className="flex-grow input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface text-sm"
                  />
                  <button
                    onClick={() => {
                      if (!noteText.trim()) return;
                      addNote(c.id, { author: user?.name ?? "Pathologist", text: noteText.trim() });
                      setNoteText("");
                    }}
                    className="bg-primary text-on-primary rounded-DEFAULT px-md py-sm text-sm font-medium hover:bg-primary-fixed transition-colors"
                  >
                    Add
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </AppShell>
  );
}
