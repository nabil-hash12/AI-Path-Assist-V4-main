const { v4: uuid } = require("uuid");
const { all, get, run, nowIso } = require("../lib/sqlHelpers");

// NOTE: metrics/boxes/tags are JS arrays. node-postgres does NOT auto-serialize
// arrays to JSON for jsonb columns (it converts them to Postgres array literal
// syntax instead), so we must JSON.stringify explicitly on write. On read,
// pg automatically parses jsonb columns back into native JS values.
function serialize(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    imageId: row.image_id,
    caseId: row.case_id,
    metrics: row.metrics,
    boxes: row.boxes,
    tags: row.tags,
    heatmapUrl: row.heatmap_path ? `/files/${row.heatmap_path}` : null,
    slideUrl: row.overlay_path ? `/files/${row.overlay_path}` : null,
    thumbnailUrl: row.thumbnail_path ? `/files/${row.thumbnail_path}` : null,
    engineVersion: row.engine_version,
    createdAt: row.created_at,
    // Present only when the row was fetched via a query that joins
    // slide_images (e.g. listForCase) — the original uploaded file name.
    fileName: row.file_name !== undefined ? row.file_name : undefined,
  };
}

async function save({ imageId, caseId, metrics, boxes, tags, heatmapPath, overlayPath, thumbnailPath }) {
  const existing = await get("SELECT * FROM analysis_results WHERE image_id = $1", [imageId]);
  if (existing) {
    await run(
      `UPDATE analysis_results SET metrics=$1, boxes=$2, tags=$3, heatmap_path=$4, overlay_path=$5, thumbnail_path=$6, created_at=$7 WHERE image_id=$8`,
      [JSON.stringify(metrics), JSON.stringify(boxes), JSON.stringify(tags), heatmapPath, overlayPath, thumbnailPath, nowIso(), imageId]
    );
  } else {
    await run(
      `INSERT INTO analysis_results (id, image_id, case_id, metrics, boxes, tags, heatmap_path, overlay_path, thumbnail_path, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [uuid(), imageId, caseId, JSON.stringify(metrics), JSON.stringify(boxes), JSON.stringify(tags), heatmapPath, overlayPath, thumbnailPath, nowIso()]
    );
  }
  return serialize(await get("SELECT * FROM analysis_results WHERE image_id = $1", [imageId]));
}

async function findByImageId(imageId) {
  return serialize(await get("SELECT * FROM analysis_results WHERE image_id = $1", [imageId]));
}

async function findLatestForCase(caseId) {
  return serialize(await get("SELECT * FROM analysis_results WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1", [caseId]));
}

/**
 * A specific analysis row, scoped to a case so a caller-supplied id can't be
 * used to pull results belonging to a different case.
 */
async function findByIdForCase(id, caseId) {
  return serialize(await get("SELECT * FROM analysis_results WHERE id = $1 AND case_id = $2", [id, caseId]));
}

/**
 * All analysis results for a case (one per analyzed slide/image), most
 * recent first, so the UI can let the user browse every analysis run
 * against a patient instead of only ever seeing the latest one.
 */
async function listForCase(caseId) {
  const rows = await all(
    `SELECT ar.*, si.file_name
     FROM analysis_results ar
     LEFT JOIN slide_images si ON si.id = ar.image_id
     WHERE ar.case_id = $1
     ORDER BY ar.created_at DESC`,
    [caseId]
  );
  return rows.map(serialize);
}

module.exports = { save, findByImageId, findLatestForCase, findByIdForCase, listForCase, serialize };
