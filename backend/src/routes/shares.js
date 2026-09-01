const express = require("express");
const casesModel = require("../models/cases");
const analysisModel = require("../models/analysis");
const misc = require("../models/misc");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/:caseId", requireAuth, requireRole("admin", "pathologist"), async (req, res) => {
  const caseRow = await casesModel.findRawByCaseCode(req.params.caseId);
  if (!caseRow) return res.status(404).json({ error: "Case not found." });
  const { reviewers, note, ttlHours } = req.body || {};
  const link = await misc.createShareLink({
    caseId: caseRow.id,
    reviewers: reviewers || "",
    note,
    createdById: req.user.id,
    ttlHours: ttlHours || 72,
  });
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: "Created tumor board share link", target: req.params.caseId });
  res.status(201).json({ share: { token: link.token, expiresAt: link.expires_at, url: `/share/${link.token}` } });
});

// Public (token-authenticated) read-only view — no requireAuth, the token IS the credential.
router.get("/view/:token", async (req, res) => {
  const link = await misc.findShareByToken(req.params.token);
  if (!link) return res.status(404).json({ error: "Share link not found." });
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: "This share link has expired." });
  }
  const caseRow = await casesModel.findRawById(link.case_id);
  if (!caseRow) return res.status(404).json({ error: "Case no longer exists." });
  const caseData = await casesModel.findByCaseCode(caseRow.case_code);
  const analysis = await analysisModel.findLatestForCase(caseRow.id);
  res.json({
    case: { id: caseData.id, patientId: caseData.patientId, specimenType: caseData.specimenType, status: caseData.status },
    analysis,
    note: link.note,
    expiresAt: link.expires_at,
  });
});

module.exports = router;
