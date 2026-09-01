const { v4: uuid } = require("uuid");
const { all, get, run, nowIso } = require("../lib/sqlHelpers");

async function create({ caseId, fileName, storedPath, mimeType, sizeBytes }) {
  const id = uuid();
  await run(
    `INSERT INTO slide_images (id, case_id, file_name, stored_path, mime_type, size_bytes, uploaded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, caseId, fileName, storedPath, mimeType, sizeBytes, nowIso()]
  );
  return get("SELECT * FROM slide_images WHERE id = $1", [id]);
}

async function findById(id) {
  return get("SELECT * FROM slide_images WHERE id = $1", [id]);
}

async function listByCase(caseId) {
  return all("SELECT * FROM slide_images WHERE case_id = $1 ORDER BY uploaded_at DESC", [caseId]);
}

async function latestForCase(caseId) {
  return get("SELECT * FROM slide_images WHERE case_id = $1 ORDER BY uploaded_at DESC LIMIT 1", [caseId]);
}

module.exports = { create, findById, listByCase, latestForCase };
