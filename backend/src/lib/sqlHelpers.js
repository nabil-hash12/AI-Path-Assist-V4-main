const pool = require("./db");

/** Run a SELECT returning all rows as plain objects. */
async function all(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

/** Run a SELECT returning the first row (or undefined). */
async function get(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows[0];
}

/** Run an INSERT/UPDATE/DELETE. Returns the pg result object. */
async function run(sql, params = []) {
  return pool.query(sql, params);
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = { pool, all, get, run, nowIso };
