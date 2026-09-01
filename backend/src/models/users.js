const { v4: uuid } = require("uuid");
const bcrypt = require("bcryptjs");
const { all, get, run, nowIso } = require("../lib/sqlHelpers");

function toPublic(u) {
  if (!u) return u;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    institution: u.institution,
    status: u.status,
    lastLogin: u.last_login,
    createdAt: u.created_at,
  };
}

async function findByEmail(email) {
  return get("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
}

async function findById(id) {
  return get("SELECT * FROM users WHERE id = $1", [id]);
}

async function listAll() {
  const rows = await all("SELECT * FROM users ORDER BY created_at ASC");
  return rows.map(toPublic);
}

/** Active admins — used to notify someone when a new registration needs approval. */
async function listAdmins() {
  return all("SELECT * FROM users WHERE role = $1 AND status = $2", ["admin", "Active"]);
}

async function create({ name, email, password, role, institution, status = "Active" }) {
  const id = uuid();
  const passwordHash = bcrypt.hashSync(password, 10);
  await run(
    `INSERT INTO users (id, name, email, password_hash, role, institution, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, name, email.toLowerCase(), passwordHash, role, institution || "General Hospital Pathology Dept", status, nowIso()]
  );
  return findById(id);
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

async function touchLogin(id) {
  await run("UPDATE users SET last_login = $1 WHERE id = $2", [nowIso(), id]);
}

async function updateRole(id, role) {
  await run("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
  return findById(id);
}

async function updateStatus(id, status) {
  await run("UPDATE users SET status = $1 WHERE id = $2", [status, id]);
  return findById(id);
}

async function updatePassword(id, password) {
  const passwordHash = bcrypt.hashSync(password, 10);
  await run("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, id]);
  return findById(id);
}

async function remove(id) {
  await run("DELETE FROM users WHERE id = $1", [id]);
}

module.exports = {
  toPublic,
  findByEmail,
  findById,
  listAll,
  listAdmins,
  create,
  verifyPassword,
  touchLogin,
  updateRole,
  updateStatus,
  updatePassword,
  remove,
};
