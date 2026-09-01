const { v4: uuid } = require("uuid");
const { all, get, run, nowIso } = require("../lib/sqlHelpers");

function serialize(row) {
  if (!row) return row;
  return {
    id: row.id,
    requestedById: row.requested_by_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    startDate: row.start_date instanceof Date ? row.start_date.toISOString().slice(0, 10) : row.start_date,
    endDate: row.end_date instanceof Date ? row.end_date.toISOString().slice(0, 10) : row.end_date,
    reason: row.reason,
    status: row.status,
    reviewedById: row.reviewed_by_id,
    reviewerName: row.reviewer_name,
    decisionNote: row.decision_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

const SELECT_WITH_NAMES = `
  SELECT
    qar.*,
    requester.name AS requester_name,
    requester.email AS requester_email,
    reviewer.name AS reviewer_name
  FROM queue_access_requests qar
  JOIN users requester ON requester.id = qar.requested_by_id
  LEFT JOIN users reviewer ON reviewer.id = qar.reviewed_by_id
`;

async function create({ requestedById, startDate, endDate, reason }) {
  const id = uuid();
  await run(
    `INSERT INTO queue_access_requests (id, requested_by_id, start_date, end_date, reason, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'Pending', $6)`,
    [id, requestedById, startDate, endDate, reason || null, nowIso()]
  );
  return findById(id);
}

async function findById(id) {
  const row = await get(`${SELECT_WITH_NAMES} WHERE qar.id = $1`, [id]);
  return serialize(row);
}

async function listForUser(userId) {
  const rows = await all(`${SELECT_WITH_NAMES} WHERE qar.requested_by_id = $1 ORDER BY qar.created_at DESC`, [userId]);
  return rows.map(serialize);
}

async function listAll(status) {
  const rows = status
    ? await all(`${SELECT_WITH_NAMES} WHERE qar.status = $1 ORDER BY qar.created_at DESC`, [status])
    : await all(`${SELECT_WITH_NAMES} ORDER BY qar.created_at DESC`);
  return rows.map(serialize);
}

async function decide(id, { status, reviewedById, decisionNote }) {
  await run(
    `UPDATE queue_access_requests SET status = $1, reviewed_by_id = $2, decision_note = $3, reviewed_at = $4 WHERE id = $5`,
    [status, reviewedById, decisionNote || null, nowIso(), id]
  );
  return findById(id);
}

module.exports = {
  create,
  findById,
  listForUser,
  listAll,
  decide,
};
