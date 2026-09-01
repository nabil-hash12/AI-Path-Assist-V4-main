const { v4: uuid } = require("uuid");
const { all, get, run, nowIso } = require("../lib/sqlHelpers");

async function caseCodeFor(internalCaseId) {
  if (!internalCaseId) return null;
  const row = await get("SELECT case_code FROM patient_cases WHERE id = $1", [internalCaseId]);
  return row ? row.case_code : null;
}

async function serialize(row) {
  return {
    id: row.id,
    fileName: row.file_name,
    framework: row.framework,
    progress: row.progress,
    status: row.status,
    eta: row.status === "active" ? formatEta(row.eta_seconds) : row.status === "queued" ? "--:--" : "",
    caseId: await caseCodeFor(row.case_id),
    imageId: row.image_id,
    errorMsg: row.error_msg,
    updatedAt: row.updated_at,
  };
}

function formatEta(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

async function create({ caseId, imageId, fileName, framework, createdById, status = "queued", etaSeconds = 30 }) {
  const id = uuid();
  await run(
    `INSERT INTO queue_jobs (id, case_id, image_id, file_name, framework, status, progress, eta_seconds, created_by_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, $10)`,
    [id, caseId || null, imageId || null, fileName, framework || "AI-Path CV Engine", status, etaSeconds, createdById || null, nowIso(), nowIso()]
  );
  return get("SELECT * FROM queue_jobs WHERE id = $1", [id]);
}

async function setBullJobId(id, bullJobId) {
  await run("UPDATE queue_jobs SET bull_job_id = $1 WHERE id = $2", [bullJobId, id]);
}

async function update(id, fields) {
  const row = await get("SELECT * FROM queue_jobs WHERE id = $1", [id]);
  if (!row) return undefined;
  const next = {
    status: fields.status ?? row.status,
    progress: fields.progress !== undefined ? Math.round(fields.progress) : row.progress,
    etaSeconds: fields.etaSeconds !== undefined ? Math.round(fields.etaSeconds) : row.eta_seconds,
    errorMsg: fields.errorMsg !== undefined ? fields.errorMsg : row.error_msg,
  };
  await run(
    `UPDATE queue_jobs SET status=$1, progress=$2, eta_seconds=$3, error_msg=$4, updated_at=$5 WHERE id=$6`,
    [next.status, next.progress, next.etaSeconds, next.errorMsg || null, nowIso(), id]
  );
  return get("SELECT * FROM queue_jobs WHERE id = $1", [id]);
}

async function active() {
  const rows = await all("SELECT * FROM queue_jobs WHERE status IN ('active','queued') ORDER BY created_at ASC");
  return Promise.all(rows.map(serialize));
}

async function history(limit = 20) {
  const rows = await all("SELECT * FROM queue_jobs WHERE status IN ('done','failed') ORDER BY updated_at DESC LIMIT $1", [limit]);
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      fileName: row.file_name,
      detail: row.status === "done" ? `Completed · ${relativeTime(row.updated_at)}` : row.error_msg || "Processing Error",
      state: row.status === "done" ? "done" : "error",
      caseId: await caseCodeFor(row.case_id),
    }))
  );
}

/** All queue jobs created within an inclusive [startDate, endDate] window (YYYY-MM-DD). Used for the researcher queue-access review, so it includes every status, not just active/done/failed. */
async function forDateRange(startDate, endDate) {
  const rangeStart = `${startDate}T00:00:00.000Z`;
  const rangeEnd = `${endDate}T23:59:59.999Z`;
  const rows = await all(
    "SELECT * FROM queue_jobs WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC",
    [rangeStart, rangeEnd]
  );
  return Promise.all(rows.map(serialize));
}

function relativeTime(ts) {
  const then = new Date(ts).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

module.exports = {
  create,
  update,
  setBullJobId,
  active,
  history,
  forDateRange,
  serialize,
  get: (id) => get("SELECT * FROM queue_jobs WHERE id = $1", [id]),
};
