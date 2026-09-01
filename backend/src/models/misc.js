const { v4: uuid } = require("uuid");
const crypto = require("crypto");
const { all, get, run, nowIso } = require("../lib/sqlHelpers");

// ---------- Reports ----------
async function nextReportCode() {
  const row = await get("SELECT report_code FROM reports ORDER BY created_at DESC LIMIT 1");
  if (!row) return "RPT-1001";
  const n = Number(row.report_code.replace(/[^0-9]/g, "")) || 1000;
  return `RPT-${n + 1}`;
}

async function createReport({ caseId, signedBy, filePath, reportCode }) {
  const id = uuid();
  const code = reportCode || (await nextReportCode());
  await run(
    `INSERT INTO reports (id, case_id, report_code, signed_by, file_path, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, caseId, code, signedBy, filePath, nowIso()]
  );
  return get("SELECT * FROM reports WHERE id = $1", [id]);
}

async function listReports() {
  return all("SELECT * FROM reports ORDER BY created_at DESC");
}

async function findReport(reportCode) {
  return get("SELECT * FROM reports WHERE report_code = $1", [reportCode]);
}

// ---------- Share Links ----------
async function createShareLink({ caseId, reviewers, note, createdById, ttlHours = 72 }) {
  const id = uuid();
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  await run(
    `INSERT INTO share_links (id, case_id, token, reviewers, note, created_by_id, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, caseId, token, reviewers, note || null, createdById || null, expires, nowIso()]
  );
  return get("SELECT * FROM share_links WHERE id = $1", [id]);
}

async function findShareByToken(token) {
  return get("SELECT * FROM share_links WHERE token = $1", [token]);
}

// ---------- Audit ----------
async function logAction({ actorId, actorName, action, target }) {
  const id = uuid();
  await run(
    `INSERT INTO audit_entries (id, actor_id, actor_name, action, target, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, actorId || null, actorName || "System", action, target, nowIso()]
  );
  return get("SELECT * FROM audit_entries WHERE id = $1", [id]);
}

async function listAudit(limit = 100) {
  const rows = await all("SELECT * FROM audit_entries ORDER BY created_at DESC LIMIT $1", [limit]);
  return rows.map((r) => ({
    id: r.id,
    actor: r.actor_name,
    action: r.action,
    target: r.target,
    time: r.created_at,
  }));
}

module.exports = {
  createReport,
  listReports,
  findReport,
  nextReportCode,
  createShareLink,
  findShareByToken,
  logAction,
  listAudit,
};
