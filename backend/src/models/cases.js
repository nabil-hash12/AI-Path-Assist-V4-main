const { v4: uuid } = require("uuid");
const { all, get, run, nowIso } = require("../lib/sqlHelpers");

async function nextCaseCode() {
  const row = await get(
    "SELECT case_code FROM patient_cases ORDER BY CAST(SUBSTRING(case_code FROM 4) AS INTEGER) DESC LIMIT 1"
  );
  const max = row ? Number(row.case_code.replace(/[^0-9]/g, "")) : 2049;
  return `HX-${max + 1}`;
}

async function nextPatientCode() {
  const row = await get("SELECT COUNT(*)::int as c FROM patient_cases");
  const n = row.c + 1;
  const num = String(1000 + n * 37).slice(0, 4);
  const suffix = String.fromCharCode(65 + (n % 4));
  return `PT-${num}-${suffix}`;
}

function serializeNote(n) {
  return { id: n.id, author: n.author_name, text: n.text, time: n.created_at };
}

async function getNotes(caseId) {
  const rows = await all("SELECT * FROM case_notes WHERE case_id = $1 ORDER BY created_at ASC", [caseId]);
  return rows.map(serializeNote);
}

async function serialize(row) {
  return {
    id: row.case_code,
    patientId: row.patient_code,
    patientName: row.patient_name,
    age: row.age,
    gender: row.gender,
    specimenType: row.specimen_type,
    dateAdded: row.date_added,
    status: row.status.replace("_", " "),
    uploadStatus: row.upload_status,
    assignedTo: row.assigned_to_name || undefined,
    diagnosisStatus: row.diagnosis_status,
    reportApproved: !!row.report_approved,
    notes: await getNotes(row.id),
  };
}

async function findByCaseCode(caseCode) {
  const row = await get("SELECT * FROM patient_cases WHERE case_code = $1", [caseCode]);
  return row ? serialize(row) : undefined;
}

async function findRawByCaseCode(caseCode) {
  return get("SELECT * FROM patient_cases WHERE case_code = $1", [caseCode]);
}

async function findRawById(id) {
  return get("SELECT * FROM patient_cases WHERE id = $1", [id]);
}

async function listAll({ assignedToId } = {}) {
  let rows;
  if (assignedToId) {
    rows = await all("SELECT * FROM patient_cases WHERE assigned_to_id = $1 ORDER BY date_added DESC", [assignedToId]);
  } else {
    rows = await all("SELECT * FROM patient_cases ORDER BY date_added DESC");
  }
  return Promise.all(rows.map(serialize));
}

/**
 * Cases whose date_added falls within any of the given [startDate, endDate]
 * (YYYY-MM-DD, inclusive) windows. Used to scope researcher visibility to
 * their admin-approved queue-access date ranges — an empty `ranges` array
 * returns no cases at all rather than falling back to "everything".
 */
async function listByDateRanges(ranges) {
  if (!ranges || ranges.length === 0) return [];
  const clauses = [];
  const params = [];
  ranges.forEach(({ startDate, endDate }) => {
    params.push(`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`);
    clauses.push(`(date_added >= $${params.length - 1} AND date_added <= $${params.length})`);
  });
  const rows = await all(
    `SELECT * FROM patient_cases WHERE ${clauses.join(" OR ")} ORDER BY date_added DESC`,
    params
  );
  return Promise.all(rows.map(serialize));
}

async function create({ patientId, patientName, age, gender, specimenType, assignedTo, createdById }) {
  const id = uuid();
  const caseCode = await nextCaseCode();
  const patientCode = (patientId && patientId.trim()) || (await nextPatientCode());
  const ts = nowIso();
  await run(
    `INSERT INTO patient_cases
     (id, case_code, patient_code, patient_name, age, gender, specimen_type, date_added, status, upload_status, diagnosis_status, report_approved, assigned_to_name, created_by_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Queued', 'Uploaded', 'Pending', false, $9, $10, $11, $12)`,
    [id, caseCode, patientCode, patientName, age, gender, specimenType || "Unspecified", ts, assignedTo || null, createdById || null, ts, ts]
  );
  return findByCaseCode(caseCode);
}

async function updateBasicInfo(caseCode, { patientName, age, gender }) {
  const row = await findRawByCaseCode(caseCode);
  if (!row) return undefined;
  await run(
    `UPDATE patient_cases SET patient_name = $1, age = $2, gender = $3, updated_at = $4 WHERE id = $5`,
    [patientName ?? row.patient_name, age ?? row.age, gender ?? row.gender, nowIso(), row.id]
  );
  return findByCaseCode(caseCode);
}

async function updateCaseRecord(caseCode, fields) {
  const row = await findRawByCaseCode(caseCode);
  if (!row) return undefined;
  const next = {
    specimenType: fields.specimenType ?? row.specimen_type,
    assignedToName: fields.assignedTo !== undefined ? fields.assignedTo : row.assigned_to_name,
    status: fields.status ?? row.status,
    diagnosisStatus: fields.diagnosisStatus ?? row.diagnosis_status,
  };
  await run(
    `UPDATE patient_cases SET specimen_type = $1, assigned_to_name = $2, status = $3, diagnosis_status = $4, updated_at = $5 WHERE id = $6`,
    [next.specimenType, next.assignedToName, next.status, next.diagnosisStatus, nowIso(), row.id]
  );
  return findByCaseCode(caseCode);
}

async function setUploadStatus(caseCode, uploadStatus) {
  const row = await findRawByCaseCode(caseCode);
  if (!row) return undefined;
  let status = row.status;
  if (uploadStatus === "Processed") status = "Completed";
  else if (uploadStatus === "Processing") status = "Processing";
  await run(`UPDATE patient_cases SET upload_status = $1, status = $2, updated_at = $3 WHERE id = $4`, [uploadStatus, status, nowIso(), row.id]);
  return findByCaseCode(caseCode);
}

async function markAssignedOnUpload(caseCode) {
  const row = await findRawByCaseCode(caseCode);
  if (!row) return undefined;
  const status = row.status === "Queued" || row.status === "Failed" ? "Processing" : row.status;
  await run(`UPDATE patient_cases SET upload_status = 'Uploaded', status = $1, updated_at = $2 WHERE id = $3`, [status, nowIso(), row.id]);
  return findByCaseCode(caseCode);
}

async function approveReport(caseCode) {
  const row = await findRawByCaseCode(caseCode);
  if (!row) return undefined;
  await run(`UPDATE patient_cases SET report_approved = true, diagnosis_status = 'Reviewed', updated_at = $1 WHERE id = $2`, [nowIso(), row.id]);
  return findByCaseCode(caseCode);
}

async function remove(caseCode) {
  const row = await findRawByCaseCode(caseCode);
  if (!row) return false;
  await run("DELETE FROM patient_cases WHERE id = $1", [row.id]);
  return true;
}

async function addNote(caseCode, { authorId, authorName, text }) {
  const row = await findRawByCaseCode(caseCode);
  if (!row) return undefined;
  const id = uuid();
  await run(
    `INSERT INTO case_notes (id, case_id, author_id, author_name, text, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, row.id, authorId || null, authorName, text, nowIso()]
  );
  return findByCaseCode(caseCode);
}

module.exports = {
  serialize,
  findByCaseCode,
  findRawByCaseCode,
  findRawById,
  listAll,
  listByDateRanges,
  create,
  updateBasicInfo,
  updateCaseRecord,
  setUploadStatus,
  markAssignedOnUpload,
  approveReport,
  remove,
  addNote,
};
