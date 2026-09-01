const express = require("express");
const queueAccess = require("../models/queueAccess");
const users = require("../models/users");
const queue = require("../models/queue");
const misc = require("../models/misc");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  sendQueueAccessRequestEmail,
  sendQueueAccessApprovedEmail,
  sendQueueAccessDeniedEmail,
} = require("../lib/queueAccessEmails");

const router = express.Router();

function isValidDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

// ─── Researcher: submit a new access request ───────────────────────────────
router.post("/requests", requireAuth, requireRole("researcher"), async (req, res) => {
  const { startDate, endDate, reason } = req.body || {};
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return res.status(400).json({ error: "startDate and endDate are required (YYYY-MM-DD)." });
  }
  if (endDate < startDate) {
    return res.status(400).json({ error: "endDate must be on or after startDate." });
  }

  const request = await queueAccess.create({ requestedById: req.user.id, startDate, endDate, reason });
  await misc.logAction({
    actorId: req.user.id,
    actorName: req.user.name,
    action: `Requested queue data access (${startDate} to ${endDate})`,
    target: "Queue Access",
  });

  try {
    const admins = await users.listAdmins();
    await sendQueueAccessRequestEmail(
      admins.map((a) => a.email),
      { researcherName: req.user.name, researcherEmail: req.user.email, startDate, endDate, reason }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Queue Access] Failed to notify admins of new request:", err.message);
  }

  res.status(201).json({ request });
});

// ─── Researcher: list my own requests ───────────────────────────────────────
router.get("/requests/mine", requireAuth, requireRole("researcher"), async (req, res) => {
  res.json({ requests: await queueAccess.listForUser(req.user.id) });
});

// ─── Admin: list all requests (optionally filtered by status) ─────────────
router.get("/requests", requireAuth, requireRole("admin"), async (req, res) => {
  const { status } = req.query || {};
  if (status && !["Pending", "Approved", "Denied"].includes(status)) {
    return res.status(400).json({ error: "Invalid status filter." });
  }
  res.json({ requests: await queueAccess.listAll(status) });
});

// ─── Admin: approve a request ───────────────────────────────────────────────
router.post("/requests/:id/approve", requireAuth, requireRole("admin"), async (req, res) => {
  const existing = await queueAccess.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Request not found." });
  if (existing.status !== "Pending") return res.status(400).json({ error: "Only pending requests can be approved." });

  const { note } = req.body || {};
  const updated = await queueAccess.decide(existing.id, { status: "Approved", reviewedById: req.user.id, decisionNote: note });
  await misc.logAction({
    actorId: req.user.id,
    actorName: req.user.name,
    action: `Approved queue data access (${updated.startDate} to ${updated.endDate})`,
    target: updated.requesterEmail,
  });

  try {
    await sendQueueAccessApprovedEmail(updated.requesterEmail, updated.requesterName, {
      startDate: updated.startDate,
      endDate: updated.endDate,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Queue Access] Failed to send approval email:", err.message);
  }

  res.json({ request: updated });
});

// ─── Admin: deny a request ───────────────────────────────────────────────────
router.post("/requests/:id/deny", requireAuth, requireRole("admin"), async (req, res) => {
  const existing = await queueAccess.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Request not found." });
  if (existing.status !== "Pending") return res.status(400).json({ error: "Only pending requests can be denied." });

  const { note } = req.body || {};
  const updated = await queueAccess.decide(existing.id, { status: "Denied", reviewedById: req.user.id, decisionNote: note });
  await misc.logAction({
    actorId: req.user.id,
    actorName: req.user.name,
    action: `Denied queue data access (${updated.startDate} to ${updated.endDate})`,
    target: updated.requesterEmail,
  });

  try {
    await sendQueueAccessDeniedEmail(updated.requesterEmail, updated.requesterName, {
      startDate: updated.startDate,
      endDate: updated.endDate,
      note,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Queue Access] Failed to send denial email:", err.message);
  }

  res.json({ request: updated });
});

// ─── Fetch the actual queue data for an approved request ───────────────────
// Owning researcher (once approved) or any admin may view it.
router.get("/requests/:id/data", requireAuth, async (req, res) => {
  const request = await queueAccess.findById(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found." });

  const isOwner = request.requestedById === req.user.id;
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ error: "You do not have access to this request." });
  if (isOwner && !isAdmin && request.status !== "Approved") {
    return res.status(403).json({ error: "This request has not been approved yet." });
  }

  const jobs = await queue.forDateRange(request.startDate, request.endDate);
  res.json({ request, jobs });
});

module.exports = router;
