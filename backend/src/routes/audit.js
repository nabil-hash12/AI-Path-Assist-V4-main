const express = require("express");
const misc = require("../models/misc");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  res.json({ audit: await misc.listAudit(100) });
});

module.exports = router;
