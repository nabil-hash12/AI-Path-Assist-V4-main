const express = require("express");
const users = require("../models/users");
const misc = require("../models/misc");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendAccountApprovedEmail, sendAccountRejectedEmail, sendUserInviteEmail } = require("../lib/otp");

const router = express.Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  res.json({ users: await users.listAll() });
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const { name, email, password, role, institution } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "name, email, password, and role are required." });
  }
  if (await users.findByEmail(email)) return res.status(409).json({ error: "Email already in use." });
  const user = await users.create({ name, email, password, role, institution, status: "Invited" });
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: `Invited user (${role})`, target: email });

  let emailSent = true;
  let emailError;
  try {
    await sendUserInviteEmail(user.email, user.name, password, role);
  } catch (err) {
    emailSent = false;
    emailError = err.message;
    // eslint-disable-next-line no-console
    console.warn("[Users] Failed to send invite email:", err.message);
  }

  res.status(201).json({ user: users.toPublic(user), emailSent, emailError });
});

router.patch("/:id/role", requireAuth, requireRole("admin"), async (req, res) => {
  const { role } = req.body || {};
  if (!["admin", "pathologist", "lab_tech", "researcher"].includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }
  const updated = await users.updateRole(req.params.id, role);
  if (!updated) return res.status(404).json({ error: "User not found." });
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: `Changed role to ${role}`, target: updated.email });
  res.json({ user: users.toPublic(updated) });
});

router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  const { status } = req.body || {};
  if (!["Active", "Invited", "Deactivated", "Pending"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const updated = await users.updateStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: "User not found." });
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: `Set status to ${status}`, target: updated.email });
  res.json({ user: users.toPublic(updated) });
});

// ─── Approve a pending self-registration ───────────────────────────────────
router.post("/:id/approve", requireAuth, requireRole("admin"), async (req, res) => {
  const target = await users.findById(req.params.id);
  if (!target) return res.status(404).json({ error: "User not found." });
  if (target.status !== "Pending") {
    return res.status(400).json({ error: "Only pending accounts can be approved." });
  }

  const updated = await users.updateStatus(target.id, "Active");
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: "Approved registration", target: updated.email });

  try {
    await sendAccountApprovedEmail(updated.email, updated.name);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Users] Failed to send approval email:", err.message);
  }

  res.json({ user: users.toPublic(updated) });
});

// ─── Reject a pending self-registration ────────────────────────────────────
router.post("/:id/reject", requireAuth, requireRole("admin"), async (req, res) => {
  const target = await users.findById(req.params.id);
  if (!target) return res.status(404).json({ error: "User not found." });
  if (target.status !== "Pending") {
    return res.status(400).json({ error: "Only pending accounts can be rejected." });
  }

  const updated = await users.updateStatus(target.id, "Deactivated");
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: "Rejected registration", target: updated.email });

  try {
    await sendAccountRejectedEmail(updated.email, updated.name);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Users] Failed to send rejection email:", err.message);
  }

  res.json({ user: users.toPublic(updated) });
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const target = await users.findById(req.params.id);
  if (!target) return res.status(404).json({ error: "User not found." });
  await users.remove(req.params.id);
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: "Deleted user", target: target.email });
  res.json({ ok: true });
});

module.exports = router;
