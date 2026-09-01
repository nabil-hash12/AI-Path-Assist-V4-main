const express = require("express");
const queue = require("../models/queue");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/active", requireAuth, async (req, res) => {
  res.json({ jobs: await queue.active() });
});

router.get("/history", requireAuth, async (req, res) => {
  res.json({ history: await queue.history(20) });
});

module.exports = router;
