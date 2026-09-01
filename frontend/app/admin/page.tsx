"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import MetricCard from "@/components/MetricCard";
import Modal from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { AuditEntry, QueueAccessRequest, Role, SystemUser } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  pathologist: "Pathologist",
  lab_tech: "Lab Technician",
  researcher: "Researcher",
};

export default function AdminControlPage() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<"users" | "audit" | "compliance" | "queue-access">("users");
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [queueRequests, setQueueRequests] = useState<QueueAccessRequest[]>([]);
  const [decidingRequestId, setDecidingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", password: "", role: "pathologist" as Role, institution: "" });
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filteredUsers = users.filter(
    (u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase())
  );

  const loadUsers = async () => {
    try {
      const res = await api.get<{ users: SystemUser[] }>("/api/users");
      setUsers(res.users);
    } catch {
      // AppShell will redirect if unauthorized
    }
  };

  const loadAudit = async () => {
    try {
      const res = await api.get<{ audit: AuditEntry[] }>("/api/audit");
      setAudit(res.audit);
    } catch {
      // ignore
    }
  };

  const loadQueueRequests = async () => {
    try {
      const res = await api.get<{ requests: QueueAccessRequest[] }>("/api/queue-access/requests");
      setQueueRequests(res.requests);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    Promise.all([loadUsers(), loadAudit(), loadQueueRequests()]).finally(() => setLoading(false));
  }, []);

  const changeRole = async (id: string, role: Role) => {
    try {
      const res = await api.patch<{ user: SystemUser }>(`/api/users/${id}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === id ? res.user : u)));
      loadAudit();
    } catch {
      // no-op; select will just revert on next load
    }
  };

  const toggleStatus = async (u: SystemUser) => {
    const next = u.status === "Deactivated" ? "Active" : "Deactivated";
    try {
      const res = await api.patch<{ user: SystemUser }>(`/api/users/${u.id}/status`, { status: next });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.user : x)));
      loadAudit();
    } catch {
      // no-op
    }
  };

  const approveUser = async (u: SystemUser) => {
    setDecidingId(u.id);
    try {
      const res = await api.post<{ user: SystemUser }>(`/api/users/${u.id}/approve`, {});
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.user : x)));
      loadAudit();
    } catch {
      // no-op
    } finally {
      setDecidingId(null);
    }
  };

  const rejectUser = async (u: SystemUser) => {
    if (!confirm(`Reject the registration request from ${u.name} (${u.email})?`)) return;
    setDecidingId(u.id);
    try {
      const res = await api.post<{ user: SystemUser }>(`/api/users/${u.id}/reject`, {});
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.user : x)));
      loadAudit();
    } catch {
      // no-op
    } finally {
      setDecidingId(null);
    }
  };

  const deleteUser = async (u: SystemUser) => {
    if (currentUser?.email === u.email) return; // safety guard; button is also disabled for self
    if (!confirm(`Permanently delete ${u.name} (${u.email})? This cannot be undone.`)) return;
    setDeletingId(u.id);
    try {
      await api.delete(`/api/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      loadAudit();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete user.");
    } finally {
      setDeletingId(null);
    }
  };

  const approveQueueRequest = async (r: QueueAccessRequest) => {
    setDecidingRequestId(r.id);
    try {
      const res = await api.post<{ request: QueueAccessRequest }>(`/api/queue-access/requests/${r.id}/approve`, {});
      setQueueRequests((prev) => prev.map((x) => (x.id === r.id ? res.request : x)));
      loadAudit();
    } catch {
      // no-op
    } finally {
      setDecidingRequestId(null);
    }
  };

  const denyQueueRequest = async (r: QueueAccessRequest) => {
    const note = prompt(`Optional note for denying ${r.requesterName}'s request (${r.startDate} to ${r.endDate}):`) || undefined;
    setDecidingRequestId(r.id);
    try {
      const res = await api.post<{ request: QueueAccessRequest }>(`/api/queue-access/requests/${r.id}/deny`, { note });
      setQueueRequests((prev) => prev.map((x) => (x.id === r.id ? res.request : x)));
      loadAudit();
    } catch {
      // no-op
    } finally {
      setDecidingRequestId(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email || !inviteForm.password) {
      setInviteError("Name, email, and a temporary password are required.");
      return;
    }
    setInviteError("");
    setInviting(true);
    try {
      const res = await api.post<{ user: SystemUser; emailSent: boolean; emailError?: string }>("/api/users", inviteForm);
      setInviteOpen(false);
      setInviteForm({ name: "", email: "", password: "", role: "pathologist", institution: "" });
      loadUsers();
      loadAudit();
      if (!res.emailSent) {
        alert(
          `${inviteForm.name}'s account was created, but the invite email could not be sent` +
            (res.emailError ? `: ${res.emailError}` : ".") +
            `\n\nShare the temporary password with them another way.`
        );
      }
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Failed to invite user.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <AppShell allow={["admin"]}>
      <TopBar
        title="Admin Control"
        showExport={false}
        showSearch={tab === "users"}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search users by name or email..."
      />
      <main className="flex-grow p-xl overflow-y-auto">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-lg">
            <MetricCard label="Total Users" value={users.length} icon="group" footnote={`Across ${new Set(users.map((u) => u.role)).size} roles`} tone="primary" />
            <MetricCard label="Active Users" value={users.filter((u) => u.status === "Active").length} icon="wifi_tethering" footnote="Currently enabled" tone="secondary" />
            <MetricCard label="Pending Invites" value={users.filter((u) => u.status === "Invited").length} icon="mail" footnote="Awaiting first login" tone="neutral" />
            <MetricCard label="Pending Approval" value={users.filter((u) => u.status === "Pending").length} icon="hourglass_top" footnote="Self-registered, needs review" tone="neutral" />
            <MetricCard label="Queue Access Requests" value={queueRequests.filter((r) => r.status === "Pending").length} icon="lock_clock" footnote="Researcher requests awaiting review" tone="neutral" />
            <MetricCard label="AI Engine" value="v1.0" icon="verified_user" footnote="Heuristic CV pipeline" tone="secondary" />
          </div>

          <div className="flex gap-2 border-b border-outline-variant">
            {[
              { id: "users" as const, label: "User Management", icon: "manage_accounts" },
              { id: "queue-access" as const, label: "Queue Access", icon: "lock_clock" },
              { id: "audit" as const, label: "Audit Log", icon: "history" },
              { id: "compliance" as const, label: "Compliance & Policy", icon: "policy" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-md py-sm font-medium text-sm border-b-2 -mb-px transition-colors ${
                  tab === t.id ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "users" && (
            <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest overflow-hidden">
              <div className="flex justify-between items-center p-lg border-b border-outline-variant">
                <h2 className="font-headline-sm">Team Members</h2>
                <button
                  onClick={() => setInviteOpen(true)}
                  className="flex items-center gap-1 text-sm bg-primary text-on-primary rounded-DEFAULT px-md py-sm font-medium hover:bg-primary-fixed transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                  Invite User
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-label-caps uppercase tracking-wider">
                      <th className="p-md font-medium">Name</th>
                      <th className="p-md font-medium">Email</th>
                      <th className="p-md font-medium">Role</th>
                      <th className="p-md font-medium">Status</th>
                      <th className="p-md font-medium">Last Login</th>
                      <th className="p-md font-medium text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-md">
                    {!loading && filteredUsers.length === 0 && (
                      <tr><td colSpan={6} className="p-md text-center text-on-surface-variant text-sm">{query ? "No users match your search." : "No users found."}</td></tr>
                    )}
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors">
                        <td className="p-md font-medium text-on-surface">{u.name}</td>
                        <td className="p-md text-on-surface-variant font-data-mono text-sm">{u.email}</td>
                        <td className="p-md">
                          <select
                            value={u.role}
                            onChange={(e) => changeRole(u.id, e.target.value as Role)}
                            className="bg-surface-container border border-outline-variant rounded px-2 py-1 text-sm text-on-surface"
                          >
                            {Object.entries(ROLE_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-md">
                          <span className={`text-xs font-data-mono px-2 py-1 rounded ${
                            u.status === "Active"
                              ? "text-secondary bg-secondary/10"
                              : u.status === "Pending"
                              ? "text-amber-600 bg-amber-500/10"
                              : "text-on-surface-variant bg-surface-variant"
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="p-md text-on-surface-variant font-data-mono text-sm">{u.lastLogin ?? "Never"}</td>
                        <td className="p-md text-center">
                          {u.status === "Pending" ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => approveUser(u)}
                                disabled={decidingId === u.id}
                                className="flex items-center gap-1 text-xs text-secondary hover:text-secondary-fixed transition-colors disabled:opacity-50"
                                title="Approve registration"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                                Approve
                              </button>
                              <button
                                onClick={() => rejectUser(u)}
                                disabled={decidingId === u.id}
                                className="flex items-center gap-1 text-xs text-error hover:text-error transition-colors disabled:opacity-50"
                                title="Reject registration"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cancel</span>
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => toggleStatus(u)}
                                className="text-on-surface-variant hover:text-error transition-colors"
                                title={u.status === "Deactivated" ? "Reactivate" : "Deactivate"}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                  {u.status === "Deactivated" ? "person_check" : "person_remove"}
                                </span>
                              </button>
                              <button
                                onClick={() => deleteUser(u)}
                                disabled={deletingId === u.id || currentUser?.email === u.email}
                                className="text-on-surface-variant hover:text-error transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title={currentUser?.email === u.email ? "You cannot delete your own account" : "Delete user permanently"}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "queue-access" && (
            <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest overflow-hidden">
              <div className="p-lg border-b border-outline-variant">
                <h2 className="font-headline-sm">Researcher Queue Access Requests</h2>
                <p className="text-on-surface-variant text-sm mt-1">
                  Researchers request a bounded date range before they can see processing-queue data. Approve or deny each request below.
                </p>
              </div>
              <ul className="flex flex-col">
                {queueRequests.length === 0 && (
                  <li className="p-md text-center text-on-surface-variant text-sm">No queue access requests yet.</li>
                )}
                {queueRequests.map((r) => (
                  <li key={r.id} className="p-md border-b border-outline-variant last:border-0 flex flex-col sm:flex-row sm:items-center gap-sm sm:justify-between hover:bg-surface-container-low transition-colors">
                    <div>
                      <p className="text-on-surface font-medium">
                        {r.requesterName} <span className="text-on-surface-variant font-data-mono text-sm">({r.requesterEmail})</span>
                      </p>
                      <p className="text-on-surface-variant text-sm font-data-mono">{r.startDate} → {r.endDate}</p>
                      {r.reason && <p className="text-on-surface-variant text-sm mt-1">{r.reason}</p>}
                      {r.status !== "Pending" && r.reviewerName && (
                        <p className="text-outline text-xs mt-1">
                          {r.status} by {r.reviewerName}{r.decisionNote ? ` — "${r.decisionNote}"` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-sm">
                      <span className={`text-xs font-data-mono px-2 py-1 rounded ${
                        r.status === "Approved"
                          ? "text-secondary bg-secondary/10"
                          : r.status === "Denied"
                          ? "text-error bg-error/10"
                          : "text-amber-600 bg-amber-500/10"
                      }`}>
                        {r.status}
                      </span>
                      {r.status === "Pending" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveQueueRequest(r)}
                            disabled={decidingRequestId === r.id}
                            className="flex items-center gap-1 text-xs text-secondary hover:text-secondary-fixed transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                            Approve
                          </button>
                          <button
                            onClick={() => denyQueueRequest(r)}
                            disabled={decidingRequestId === r.id}
                            className="flex items-center gap-1 text-xs text-error hover:text-error transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cancel</span>
                            Deny
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "audit" && (
            <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest overflow-hidden">
              <div className="p-lg border-b border-outline-variant">
                <h2 className="font-headline-sm">Audit Trail</h2>
                <p className="text-on-surface-variant text-sm mt-1">Immutable log of clinically significant actions across the platform.</p>
              </div>
              <ul className="flex flex-col">
                {audit.length === 0 && <li className="p-md text-center text-on-surface-variant text-sm">No audit entries yet.</li>}
                {audit.map((l) => (
                  <li key={l.id} className="p-md border-b border-outline-variant last:border-0 flex justify-between items-center hover:bg-surface-container-low transition-colors">
                    <div>
                      <p className="text-on-surface font-medium">{l.action}</p>
                      <p className="text-on-surface-variant text-sm">
                        {l.actor} · <span className="font-data-mono">{l.target}</span>
                      </p>
                    </div>
                    <span className="text-outline text-xs font-data-mono">{l.time}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "compliance" && (
            <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest p-lg flex flex-col gap-md">
              <h2 className="font-headline-sm mb-2">Compliance & Policy</h2>
              {[
                { label: "JWT-based session authentication (12h expiry)", enabled: true },
                { label: "Role-based access control enforced on every API route", enabled: true },
                { label: "Require reviewer sign-off before report export", enabled: true },
                { label: "Tumor board share links expire automatically (72h)", enabled: true },
                { label: "Full audit trail of clinically significant actions", enabled: true },
              ].map((p) => (
                <div key={p.label} className="flex items-center justify-between border-b border-outline-variant py-sm last:border-0">
                  <span className="text-on-surface">{p.label}</span>
                  <span className="text-secondary text-sm font-data-mono flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                    Enforced
                  </span>
                </div>
              ))}
              <p className="text-xs text-on-surface-variant font-data-mono mt-2">
                Note: this is a demo/academic build. Production HIPAA compliance would additionally require encryption at rest, BAAs with hosting providers, and formal access review processes.
              </p>
            </section>
          )}
        </div>
      </main>
      <Footer />

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite User" icon="person_add">
        {inviteError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/10 px-3 py-2 text-sm text-error">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
            {inviteError}
          </div>
        )}
        <form className="flex flex-col gap-md" onSubmit={handleInvite}>
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-on-surface-variant">Full Name</span>
            <input className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface" value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-on-surface-variant">Email</span>
            <input type="email" className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-on-surface-variant">Temporary Password</span>
            <input type="text" className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface font-data-mono" value={inviteForm.password} onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-on-surface-variant">Role</span>
            <select className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface" value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as Role }))}>
              {Object.entries(ROLE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-on-surface-variant">Institution (optional)</span>
            <input className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface" value={inviteForm.institution} onChange={(e) => setInviteForm((f) => ({ ...f, institution: e.target.value }))} />
          </label>
          <button type="submit" disabled={inviting} className="w-full bg-primary text-on-primary rounded-DEFAULT py-sm font-headline-sm hover:bg-primary-fixed transition-colors disabled:opacity-60">
            {inviting ? "Inviting…" : "Send Invite"}
          </button>
        </form>
      </Modal>
    </AppShell>
  );
}
