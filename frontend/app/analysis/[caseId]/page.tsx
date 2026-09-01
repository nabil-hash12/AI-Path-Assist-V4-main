"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Footer from "@/components/Footer";
import Modal from "@/components/Modal";
import { usePatients } from "@/lib/patients-context";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { useSidebar } from "@/lib/sidebar-context";
import { api, ApiError, fileUrl } from "@/lib/api";
import { AnalysisResult, QueueJob } from "@/lib/types";
import { ThemeToggleIcon } from "@/components/ThemeToggle";

export default function AnalysisViewerPage() {
  const params = useParams<{ caseId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { getById, fetchById } = usePatients();
  const caseId = params.caseId;
  const specimen = getById(caseId);

  // Every analysis run against this patient (one per analyzed slide), most
  // recent first — the selector strip lets the user browse all of them.
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const analysis = analyses.find((a) => a.id === selectedAnalysisId) ?? analyses[0] ?? null;
  const [analysisState, setAnalysisState] = useState<"loading" | "ready" | "processing" | "empty" | "error">("loading");
  const [activeJob, setActiveJob] = useState<QueueJob | null>(null);
  const { joinCase, leaveCase, onJobProgress, onJobDone, onAnalysisReady } = useSocket();
  const { openMobile } = useSidebar();

  useEffect(() => {
    fetchById(caseId);
    joinCase(caseId);
    return () => leaveCase(caseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // Load every analysis result for this patient — once on mount and
  // whenever Socket.IO tells us a new result is ready.
  const loadAnalyses = async () => {
    try {
      const res = await api.get<{ analyses: AnalysisResult[] }>(`/api/cases/${caseId}/analyses`);
      setAnalyses(res.analyses);
      if (res.analyses.length > 0) {
        // Keep the current selection if it still exists; otherwise default
        // to the most recent analysis.
        setSelectedAnalysisId((prev) => (prev && res.analyses.some((a) => a.id === prev) ? prev : res.analyses[0].id));
        setAnalysisState("ready");
        setActiveJob(null);
        fetchById(caseId);
        return;
      }
      throw new Error("no analyses yet");
    } catch {
      // No result yet — check queue for an active job.
      try {
        const q = await api.get<{ jobs: QueueJob[] }>("/api/queue/active");
        const job = q.jobs.find((j) => j.caseId === caseId) || null;
        if (job) {
          setActiveJob(job);
          setAnalysisState("processing");
        } else {
          setAnalysisState((prev) => (prev === "processing" ? "error" : "empty"));
        }
      } catch {
        setAnalysisState("error");
      }
    }
  };

  useEffect(() => {
    loadAnalyses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // Real-time: update progress bar as worker runs.
  useEffect(() => {
    const off = onJobProgress((e) => {
      if (e.caseId !== caseId) return;
      setActiveJob((prev) => ({ ...(prev ?? ({} as QueueJob)), id: e.jobId, fileName: e.fileName, progress: e.progress, status: e.status as "active" | "queued" | "failed", eta: e.eta }));
      setAnalysisState("processing");
    });
    return off;
  }, [caseId, onJobProgress]);

  // Real-time: job finished — reload the full list immediately. New results
  // are appended, not replaced, so earlier analyses stay browsable.
  useEffect(() => {
    const off = onJobDone((e) => {
      if (e.caseId !== caseId) return;
      if (e.status === "failed") {
        setAnalysisState("error");
        setActiveJob(null);
      } else {
        loadAnalyses().then(() => setSelectedAnalysisId(null));
      }
    });
    return off;
  }, [caseId, onJobDone]);

  // Real-time: analysis:ready is also fired when the worker saves results.
  useEffect(() => {
    const off = onAnalysisReady((e) => {
      if (e.caseId !== caseId) return;
      loadAnalyses().then(() => setSelectedAnalysisId(null));
    });
    return off;
  }, [caseId, onAnalysisReady]);

  const [gradCam, setGradCam] = useState(true);
  const [opacity, setOpacity] = useState(75);
  const [showBoxes, setShowBoxes] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [shareSent, setShareSent] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareReviewers, setShareReviewers] = useState("dr.rahman@bubt.edu, dr.mohaimin@bubt.edu");
  const [shareNote, setShareNote] = useState("Requesting a second opinion on this specimen.");
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportUrl, setReportUrl] = useState("");
  const [reportError, setReportError] = useState("");
  const [generating, setGenerating] = useState(false);

  const metrics = analysis?.metrics ?? [];

  const severityStyles: Record<string, string> = {
    high: "border-error-container",
    elevated: "border-tertiary-container",
    nominal: "",
  };
  const severityBadge: Record<string, string> = {
    high: "bg-error-container text-on-error-container border border-error",
    elevated: "bg-tertiary-container/20 text-tertiary border border-tertiary-container",
    nominal: "bg-surface-variant text-on-surface-variant",
  };
  const severityValueColor: Record<string, string> = {
    high: "text-error",
    elevated: "text-tertiary",
    nominal: "text-on-surface",
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareError("");
    try {
      const res = await api.post<{ share: { token: string; url: string; expiresAt: string } }>(`/api/share/${caseId}`, {
        reviewers: shareReviewers,
        note: shareNote,
      });
      setShareUrl(`${window.location.origin}${res.share.url}`);
      setShareSent(true);
    } catch (err) {
      setShareError(err instanceof ApiError ? err.message : "Failed to create share link.");
    }
  };

  const handleGenerateReport = async () => {
    setReportError("");
    setGenerating(true);
    try {
      const res = await api.post<{ report: { id: string; downloadUrl: string } }>(`/api/reports/${caseId}/generate`, {
        analysisId: analysis?.id,
      });
      setReportUrl(fileUrl(res.report.downloadUrl) || "");
      setReportGenerated(true);
    } catch (err) {
      setReportError(err instanceof ApiError ? err.message : "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell allow={["admin", "pathologist", "researcher"]}>
      <div className="h-dvh flex flex-col overflow-hidden">
        <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-30 border-b border-outline-variant flex justify-between items-center w-full px-margin h-16 flex-shrink-0">
          <div className="flex items-center gap-md min-w-0">
            <button
              onClick={openMobile}
              className="lg:hidden p-xs -ml-xs text-on-surface-variant hover:text-on-surface rounded-DEFAULT hover:bg-surface-container-high flex-shrink-0"
              aria-label="Open navigation"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <button onClick={() => router.push("/analysis")} className="text-on-surface-variant hover:text-on-surface flex-shrink-0">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <span className="font-headline-sm text-primary truncate">
              Analysis / Specimen {caseId} {specimen ? `· ${specimen.patientId}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-lg flex-shrink-0">
            <ThemeToggleIcon />
            {analysis && (
              <a
                href={fileUrl(analysis.slideUrl)}
                download
                className="p-xs text-on-surface-variant hover:text-primary rounded-DEFAULT hover:bg-surface-container-high"
                title="Download slide image"
              >
                <span className="material-symbols-outlined">ios_share</span>
              </a>
            )}
            <button
              onClick={handleGenerateReport}
              disabled={generating || !analysis}
              className="bg-primary text-on-primary font-body-md px-md py-sm rounded-DEFAULT hover:bg-primary-container transition-colors font-medium flex items-center gap-xs disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              {generating ? "Generating…" : "Export"}
            </button>
          </div>
        </header>

        {analyses.length > 1 && (
          <div className="flex-shrink-0 bg-surface-container-lowest border-b border-outline-variant px-margin py-sm">
            <p className="font-label-caps text-on-surface-variant uppercase tracking-wider mb-xs">
              {analyses.length} Analyses for this Patient
            </p>
            <div className="flex items-center gap-sm overflow-x-auto pb-1">
              {analyses.map((a) => {
                const isSelected = a.id === analysis?.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAnalysisId(a.id)}
                    title={a.fileName || a.id}
                    className={`flex-shrink-0 flex items-center gap-sm rounded-DEFAULT border p-xs pr-sm transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-outline-variant bg-surface-container hover:bg-surface-container-high"
                    }`}
                  >
                    <div className="w-10 h-10 rounded overflow-hidden bg-surface-container-highest flex-shrink-0 flex items-center justify-center">
                      {a.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(a.thumbnailUrl)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>image</span>
                      )}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className={`font-data-mono text-xs ${isSelected ? "text-primary" : "text-on-surface"} max-w-[140px] truncate`}>
                        {a.fileName || `Slide ${a.imageId.slice(0, 8)}`}
                      </span>
                      <span className="text-on-surface-variant text-[11px]">{new Date(a.createdAt).toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <main className="flex-grow flex flex-col lg:flex-row overflow-hidden relative min-h-0">
          {/* Slide viewer canvas */}
          <div className="flex-grow min-h-[45dvh] lg:min-h-0 relative bg-black overflow-hidden flex flex-col">
            <div className="flex-grow relative w-full h-full cursor-crosshair flex items-center justify-center overflow-auto">
              {analysisState === "ready" && analysis ? (
                <div className="relative" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}>
                  <img src={fileUrl(analysis.slideUrl)} alt="Slide" className="max-w-none select-none" draggable={false} />
                  {gradCam && analysis.heatmapUrl && (
                    <img
                      src={fileUrl(analysis.heatmapUrl)}
                      alt="AI heatmap overlay"
                      className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300"
                      style={{ opacity: opacity / 100 }}
                      draggable={false}
                    />
                  )}
                  {showBoxes &&
                    analysis.boxes.map((b, i) => (
                      <div
                        key={i}
                        className="absolute border-2 border-secondary/80 rounded-sm"
                        style={{
                          left: `${b.x * 100}%`,
                          top: `${b.y * 100}%`,
                          width: `${b.w * 100}%`,
                          height: `${b.h * 100}%`,
                        }}
                        title={`Region confidence: ${(b.score * 100).toFixed(0)}%`}
                      />
                    ))}
                </div>
              ) : analysisState === "processing" ? (
                <div className="flex flex-col items-center gap-4 text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 48 }}>progress_activity</span>
                  <p className="font-headline-sm text-on-surface">Running AI inference…</p>
                  {activeJob && (
                    <div className="w-64">
                      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${activeJob.progress}%` }} />
                      </div>
                      <p className="text-xs font-data-mono mt-2 text-center">{activeJob.progress}% · ETA {activeJob.eta}</p>
                    </div>
                  )}
                </div>
              ) : analysisState === "empty" ? (
                <div className="flex flex-col items-center gap-4 text-on-surface-variant text-center max-w-sm">
                  <span className="material-symbols-outlined" style={{ fontSize: 64 }}>biotech</span>
                  <p className="font-headline-sm text-on-surface">No slide image analyzed yet</p>
                  <p className="text-sm">Upload a histopathology image from the patient record to run AI inference.</p>
                  {specimen && (
                    <button
                      onClick={() => router.push(`/patients/${caseId}`)}
                      className="mt-2 bg-primary text-on-primary rounded-DEFAULT px-md py-sm text-sm font-medium hover:bg-primary-fixed transition-colors"
                    >
                      Go to Patient Record
                    </button>
                  )}
                </div>
              ) : analysisState === "error" ? (
                <div className="flex flex-col items-center gap-3 text-error text-center">
                  <span className="material-symbols-outlined" style={{ fontSize: 48 }}>error</span>
                  <p className="font-headline-sm">Analysis failed or unavailable</p>
                  <p className="text-sm text-on-surface-variant">Try re-uploading the slide image, or contact your administrator.</p>
                </div>
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant/40 animate-pulse" style={{ fontSize: 64 }}>hourglass_top</span>
              )}

              {analysisState === "ready" && (
                <>
                  <div className="absolute left-md top-1/2 -translate-y-1/2 glass-panel rounded-lg p-xs flex flex-col gap-xs z-10">
                    <button
                      onClick={() => setShowBoxes((v) => !v)}
                      title="Toggle detected regions"
                      className={`p-sm rounded-DEFAULT transition-colors ${showBoxes ? "text-primary bg-surface-container-high border border-outline-variant" : "text-on-surface hover:text-primary hover:bg-surface-container"}`}
                    >
                      <span className="material-symbols-outlined">crop_free</span>
                    </button>
                    <button
                      onClick={() => setGradCam((v) => !v)}
                      title="Toggle heatmap overlay"
                      className={`p-sm rounded-DEFAULT transition-colors ${gradCam ? "text-primary bg-surface-container-high border border-outline-variant" : "text-on-surface hover:text-primary hover:bg-surface-container"}`}
                    >
                      <span className="material-symbols-outlined">thermostat</span>
                    </button>
                  </div>

                  <div className="absolute right-md bottom-md glass-panel rounded-lg flex items-center p-xs z-10">
                    <button onClick={() => setZoom((z) => Math.max(25, z - 25))} className="p-xs text-on-surface hover:text-primary rounded-DEFAULT">
                      <span className="material-symbols-outlined">remove</span>
                    </button>
                    <span className="font-data-mono text-on-surface px-sm">{zoom}%</span>
                    <button onClick={() => setZoom((z) => Math.min(300, z + 25))} className="p-xs text-on-surface hover:text-primary rounded-DEFAULT">
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right sidebar: metrics & controls — stacks below the viewer on
              small/medium screens instead of squeezing it horizontally */}
          <aside className="w-full lg:w-80 bg-surface-container-lowest border-t lg:border-t-0 lg:border-l border-outline-variant flex flex-col flex-shrink-0 z-20 overflow-y-auto lg:h-full max-h-[45dvh] lg:max-h-none">
            <div className="p-md border-b border-outline-variant">
              <h2 className="font-label-caps text-on-surface-variant uppercase tracking-wider mb-md">Visualization</h2>
              <div className="flex items-center justify-between mb-md">
                <span className="font-body-md text-on-surface">Grad-CAM Overlay</span>
                <button
                  onClick={() => setGradCam((v) => !v)}
                  className={`relative w-10 h-6 rounded-full border transition-colors ${gradCam ? "bg-primary border-primary" : "bg-surface-container border-outline-variant"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${gradCam ? "translate-x-4" : ""}`} />
                </button>
              </div>
              <div className="space-y-sm mb-sm">
                <div className="flex justify-between font-label-caps text-on-surface-variant">
                  <span>Overlay Opacity</span>
                  <span className="font-data-mono">{opacity}%</span>
                </div>
                <input className="range-slider" max={100} min={0} type="range" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
              </div>
              {analysis && (
                <p className="text-xs text-on-surface-variant font-data-mono mt-sm">{analysis.engineVersion}</p>
              )}
            </div>

            <div className="p-md flex-grow">
              <div className="flex items-center justify-between mb-md">
                <h2 className="font-label-caps text-on-surface-variant uppercase tracking-wider">AI Inference Results</h2>
                <span className={`flex h-2 w-2 rounded-full ${analysisState === "ready" ? "bg-secondary" : "bg-outline-variant"}`} />
              </div>
              {metrics.length === 0 ? (
                <p className="text-on-surface-variant text-sm">No results yet.</p>
              ) : (
                <div className="space-y-sm">
                  {metrics.map((m) => (
                    <div key={m.key} className={`bg-surface-container rounded-lg p-sm border ${severityStyles[m.severity] || "border-transparent"}`}>
                      <div className="flex justify-between items-start mb-xs">
                        <span className="font-body-md font-medium text-on-surface">{m.label}</span>
                        <span className={`font-data-mono px-xs py-0.5 rounded text-xs ${severityBadge[m.severity]}`}>{m.tag}</span>
                      </div>
                      <div className="flex items-baseline gap-sm">
                        <span className={`font-display text-headline-md ${severityValueColor[m.severity]}`}>{m.value}</span>
                        {m.unit && <span className="text-on-surface-variant text-xs">{m.unit}</span>}
                        {m.confidence && <span className="text-on-surface-variant text-xs">Confidence: {m.confidence}%</span>}
                      </div>
                      {m.barPercent !== undefined && (
                        <div className="w-full h-1 bg-surface-variant mt-sm rounded-full overflow-hidden">
                          <div className={`h-full ${m.severity === "high" ? "bg-error" : "bg-primary"}`} style={{ width: `${m.barPercent}%` }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {analysis && analysis.tags.length > 0 && (
                <div className="mt-md">
                  <h3 className="font-label-caps text-on-surface-variant mb-xs">Detected Biomarkers</h3>
                  <div className="flex flex-wrap gap-xs">
                    {analysis.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 border border-outline-variant rounded-full text-xs font-data-mono text-primary">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-md border-t border-outline-variant bg-surface-container-lowest mt-auto sticky bottom-0">
              <button
                onClick={() => setShareOpen(true)}
                disabled={!analysis}
                className="w-full flex items-center justify-center gap-sm p-md rounded-DEFAULT border border-primary text-primary hover:bg-primary/10 transition-colors mb-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined">group</span>
                Tumor Board Share
              </button>
              <button
                onClick={() => setReportOpen(true)}
                disabled={!analysis}
                className="w-full flex items-center justify-center gap-sm p-md rounded-DEFAULT bg-primary text-on-primary hover:bg-primary-container transition-colors font-medium disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_document</span>
                Generate Report
              </button>
            </div>
          </aside>
        </main>

        <Footer offset={false} />
      </div>

      <Modal open={shareOpen} onClose={() => { setShareOpen(false); setShareSent(false); }} title="Tumor Board Share" icon="group">
        {shareSent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 40 }}>check_circle</span>
            <p className="text-on-surface font-medium">Case {caseId} shared with the tumor board.</p>
            <p className="text-on-surface-variant text-sm">All reviewers get view-only access via this link (expires in 72 hours):</p>
            <div className="w-full bg-surface-container rounded-lg px-3 py-2 text-xs font-data-mono break-all text-primary">{shareUrl}</div>
          </div>
        ) : (
          <form className="flex flex-col gap-md" onSubmit={handleShare}>
            {shareError && (
              <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/10 px-3 py-2 text-sm text-error">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
                {shareError}
              </div>
            )}
            <label className="flex flex-col gap-1">
              <span className="font-label-caps text-on-surface-variant">Reviewers (comma separated emails)</span>
              <input className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface" value={shareReviewers} onChange={(e) => setShareReviewers(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-caps text-on-surface-variant">Note</span>
              <textarea className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface" rows={3} value={shareNote} onChange={(e) => setShareNote(e.target.value)} />
            </label>
            <button type="submit" className="w-full bg-primary text-on-primary rounded-DEFAULT py-sm font-headline-sm hover:bg-primary-fixed transition-colors">
              Share Securely
            </button>
          </form>
        )}
      </Modal>

      <Modal open={reportOpen} onClose={() => { setReportOpen(false); setReportGenerated(false); }} title="Generate Diagnostic Report" icon="edit_document">
        {reportGenerated ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 40 }}>task_alt</span>
            <p className="text-on-surface font-medium">Report generated for case {caseId}.</p>
            <p className="text-on-surface-variant text-sm">Signed by {user?.name ?? "current pathologist"}.</p>
            <a href={reportUrl} download target="_blank" rel="noreferrer" className="mt-1 text-primary text-sm font-medium hover:text-primary-fixed">
              Download PDF ↓
            </a>
            <button onClick={() => router.push("/reports")} className="mt-1 text-primary text-sm font-medium hover:text-primary-fixed">
              Go to Reports →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            {reportError && (
              <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/10 px-3 py-2 text-sm text-error">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
                {reportError}
              </div>
            )}
            <p className="text-on-surface-variant text-sm">
              This compiles the current slide image, biomarker panel, and case notes into a signed PDF diagnostic report.
            </p>
            <ul className="text-sm text-on-surface-variant flex flex-col gap-1">
              {metrics.map((m) => (
                <li key={m.key} className="flex justify-between border-b border-outline-variant py-1">
                  <span>{m.label}</span>
                  <span className="font-data-mono text-on-surface">{m.value}{m.unit ? ` ${m.unit}` : ""}</span>
                </li>
              ))}
            </ul>
            <button onClick={handleGenerateReport} disabled={generating} className="w-full bg-primary text-on-primary rounded-DEFAULT py-sm font-headline-sm hover:bg-primary-fixed transition-colors disabled:opacity-60">
              {generating ? "Generating…" : "Confirm & Generate"}
            </button>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
