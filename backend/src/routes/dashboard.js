const express = require("express");
const { all, get } = require("../lib/sqlHelpers");
const misc = require("../models/misc");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function toneForAction(action) {
  const a = action.toLowerCase();
  if (a.includes("fail") || a.includes("error") || a.includes("deactivat")) return "error";
  if (a.includes("completed") || a.includes("approved") || a.includes("generated")) return "secondary";
  if (a.includes("uploaded") || a.includes("created") || a.includes("logged in")) return "primary";
  return "neutral";
}

router.get("/stats", requireAuth, async (req, res) => {
  const activeCasesRow = await get("SELECT COUNT(*)::int as c FROM patient_cases WHERE status NOT IN ('Completed','Failed')");
  const pendingReviewsRow = await get("SELECT COUNT(*)::int as c FROM patient_cases WHERE diagnosis_status = 'Pending'");
  const totalCasesRow = await get("SELECT COUNT(*)::int as c FROM patient_cases");

  const doneJobs = await all(
    "SELECT created_at, updated_at FROM queue_jobs WHERE status = 'done' ORDER BY updated_at DESC LIMIT 25"
  );
  let avgSeconds = 1.4;
  if (doneJobs.length > 0) {
    const durations = doneJobs.map((j) => {
      const start = new Date(j.created_at).getTime();
      const end = new Date(j.updated_at).getTime();
      return Math.max(0.1, (end - start) / 1000);
    });
    avgSeconds = durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  res.json({
    activeCases: activeCasesRow.c,
    totalCases: totalCasesRow.c,
    pendingReviews: pendingReviewsRow.c,
    avgInferenceSeconds: Math.round(avgSeconds * 10) / 10,
  });
});

router.get("/activity", requireAuth, async (req, res) => {
  const rows = await misc.listAudit(12);
  const entries = rows.map((e) => ({
    id: e.id,
    title: e.action,
    detail: e.target,
    time: e.time,
    tone: toneForAction(e.action),
  }));
  res.json({ activity: entries });
});

module.exports = router;
