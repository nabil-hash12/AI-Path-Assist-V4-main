"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import { api, ApiError } from "@/lib/api";
import { QueueAccessRequest, QueueRecord } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  Pending: "text-amber-600 bg-amber-500/10 border border-amber-500/30",
  Approved: "text-secondary bg-secondary/10 border border-secondary/30",
  Denied: "text-error bg-error/10 border border-error/30",
};

export default function QueueAccessPage() {
  const [requests, setRequests] = useState<QueueAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [jobsById, setJobsById] = useState<Record<string, QueueRecord[]>>({});
  const [jobsLoading, setJobsLoading] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<Record<string, string>>({});

  const loadRequests = async () => {
    try {
      const res = await api.get<{ requests: QueueAccessRequest[] }>("/api/queue-access/requests/mine");
      setRequests(res.requests);
    } catch {
      // AppShell will redirect if unauthorized
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate) {
      setFormError("Choose a start date and an end date.");
      return;
    }
    if (form.endDate < form.startDate) {
      setFormError("End date must be on or after the start date.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      await api.post("/api/queue-access/requests", form);
      setForm({ startDate: "", endDate: "", reason: "" });
      loadRequests();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleData = async (request: QueueAccessRequest) => {
    if (expandedId === request.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(request.id);
    if (jobsById[request.id]) return;
    setJobsLoading(request.id);
    try {
      const res = await api.get<{ jobs: QueueRecord[] }>(`/api/queue-access/requests/${request.id}/data`);
      setJobsById((prev) => ({ ...prev, [request.id]: res.jobs }));
    } catch (err) {
      setJobsError((prev) => ({ ...prev, [request.id]: err instanceof ApiError ? err.message : "Failed to load data." }));
    } finally {
      setJobsLoading(null);
    }
  };

  return (
    <AppShell allow={["researcher"]}>
      <TopBar title="Queue Data Access" showExport={false} showSearch={false} />
      <main className="flex-grow p-xl overflow-y-auto">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-lg">
          <section className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-lg">
            <h2 className="font-headline-sm mb-1 flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary">lock_clock</span>
              Request Access to Queue Data
            </h2>
            <p className="text-on-surface-variant text-sm mb-lg">
              Specimen data is not visible by default. Request a specific date range below — once an administrator
              approves it, matching specimens will appear on your{" "}
              <Link href="/analysis" className="text-primary font-medium hover:text-primary-fixed">Analysis / Queue</Link> page automatically.
            </p>
            {formError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/10 px-3 py-2 text-sm text-error">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
                {formError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <label className="flex flex-col gap-xs">
                  <span className="font-label-caps text-on-surface-variant">Start Date</span>
                  <input
                    type="date"
                    className="bg-surface border border-outline-variant rounded px-md py-sm text-on-surface"
                    value={form.startDate}
                    max={form.endDate || undefined}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-xs">
                  <span className="font-label-caps text-on-surface-variant">End Date</span>
                  <input
                    type="date"
                    className="bg-surface border border-outline-variant rounded px-md py-sm text-on-surface"
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </label>
              </div>
            <label className="flex flex-col gap-xs">
              <span className="font-label-caps text-on-surface-variant">
                Reason <span className="text-error">(Mandatory)</span>
              </span>
              <textarea
                required
                className="bg-surface border border-outline-variant rounded px-md py-sm text-on-surface min-h-[80px]"
                placeholder="Briefly describe why you need this data…"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </label>
              <button
                type="submit"
                disabled={submitting}
                className="self-start flex items-center gap-2 text-sm bg-primary text-on-primary rounded-DEFAULT px-md py-sm font-medium hover:bg-primary-fixed transition-colors disabled:opacity-60"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </form>
          </section>

          <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest overflow-hidden">
            <div className="p-lg border-b border-outline-variant">
              <h2 className="font-headline-sm">My Requests</h2>
              <p className="text-on-surface-variant text-sm mt-1">Track approval status and view data once a request is approved.</p>
            </div>
            <div className="flex flex-col">
              {!loading && requests.length === 0 && (
                <p className="p-md text-center text-on-surface-variant text-sm">No requests yet — submit one above.</p>
              )}
              {requests.map((r) => (
                <div key={r.id} className="border-b border-outline-variant last:border-0">
                  <div className="p-md flex flex-col sm:flex-row sm:items-center gap-sm sm:justify-between">
                    <div>
                      <p className="text-on-surface font-medium font-data-mono">{r.startDate} → {r.endDate}</p>
                      {r.reason && <p className="text-on-surface-variant text-sm mt-1">{r.reason}</p>}
                      {r.status === "Denied" && r.decisionNote && (
                        <p className="text-error text-xs mt-1">Admin note: {r.decisionNote}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-sm">
                      <span className={`text-xs font-data-mono px-2 py-1 rounded ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                      {r.status === "Approved" && (
                        <>
                          <Link
                            href="/analysis"
                            className="text-primary text-xs font-medium hover:text-primary-fixed flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                            View in Queue
                          </Link>
                          <button
                            onClick={() => toggleData(r)}
                            className="text-on-surface-variant text-xs font-medium hover:text-on-surface flex items-center gap-1"
                            title="Show the underlying processing-job log for this range"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                              {expandedId === r.id ? "expand_less" : "receipt_long"}
                            </span>
                            {expandedId === r.id ? "Hide Job Log" : "Job Log"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {expandedId === r.id && (
                    <div className="px-md pb-md">
                      {jobsLoading === r.id && (
                        <p className="text-on-surface-variant text-sm p-md">Loading queue data…</p>
                      )}
                      {jobsError[r.id] && (
                        <p className="text-error text-sm p-md">{jobsError[r.id]}</p>
                      )}
                      {jobsById[r.id] && (
                        <div className="overflow-x-auto border border-outline-variant rounded-lg">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-outline-variant bg-surface-container-low font-label-caps text-on-surface-variant uppercase tracking-wider">
                                <th className="p-sm font-medium">Slide ID</th>
                                <th className="p-sm font-medium">Framework</th>
                                <th className="p-sm font-medium">Status</th>
                                <th className="p-sm font-medium">Case</th>
                                <th className="p-sm font-medium text-right">Updated</th>
                              </tr>
                            </thead>
                            <tbody className="font-body-md">
                              {jobsById[r.id].length === 0 && (
                                <tr>
                                  <td colSpan={5} className="p-sm text-center text-on-surface-variant text-sm">No queue jobs in this date range.</td>
                                </tr>
                              )}
                              {jobsById[r.id].map((job) => (
                                <tr key={job.id} className="border-b border-outline-variant last:border-0">
                                  <td className="p-sm font-data-mono text-sm">{job.fileName}</td>
                                  <td className="p-sm text-sm">{job.framework}</td>
                                  <td className="p-sm text-sm capitalize">{job.status}</td>
                                  <td className="p-sm font-data-mono text-xs text-on-surface-variant">{job.caseId ?? "—"}</td>
                                  <td className="p-sm text-right font-data-mono text-xs text-on-surface-variant">{job.updatedAt}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </AppShell>
  );
}
