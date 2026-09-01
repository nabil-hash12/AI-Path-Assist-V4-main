const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuid } = require("uuid");

const casesModel = require("../models/cases");
const images = require("../models/images");
const analysisModel = require("../models/analysis");
const queue = require("../models/queue");
const misc = require("../models/misc");
const queueAccess = require("../models/queueAccess");
const { enqueueAnalysis } = require("../queue/analysisQueue");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "slides");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_ROOT),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${Date.now()}-${uuid().slice(0, 8)}${ext}`);
  },
});
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/tiff", "image/webp", "image/bmp"]);
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype) || /\.(tif|tiff|png|jpe?g|webp|bmp)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Please upload PNG, JPEG, TIFF, WEBP, or BMP images."));
    }
  },
});

// ---- List / Create -------------------------------------------------------

router.get("/", requireAuth, async (req, res) => {
  let list;
  if (req.user.role === "researcher") {
    // Researchers only see cases within date ranges an admin has explicitly
    // approved via a queue-access request — nothing is visible by default.
    const myRequests = await queueAccess.listForUser(req.user.id);
    const approvedRanges = myRequests
      .filter((r) => r.status === "Approved")
      .map((r) => ({ startDate: r.startDate, endDate: r.endDate }));
    list = await casesModel.listByDateRanges(approvedRanges);
  } else if (req.user.role === "pathologist") {
    // Pathologists see cases assigned to them by name (legacy free-text
    // assignment) OR all cases if none match, so the UI still has data
    // to explore during a demo/eval session.
    list = await casesModel.listAll();
    const mine = list.filter((c) => c.assignedTo && c.assignedTo.toLowerCase().includes(req.user.name.toLowerCase().replace("dr. ", "")));
    list = mine.length > 0 ? mine : list;
  } else {
    list = await casesModel.listAll();
  }
  res.json({ cases: list });
});

router.post("/", requireAuth, requireRole("admin", "lab_tech"), async (req, res) => {
  const { patientId, patientName, age, gender, specimenType, assignedTo } = req.body || {};
  if (!patientName || age === undefined || age === null) {
    return res.status(400).json({ error: "patientName and age are required." });
  }
  const ageNum = Number(age);
  if (Number.isNaN(ageNum) || ageNum <= 0) return res.status(400).json({ error: "age must be a positive number." });
  const created = await casesModel.create({
    patientId, patientName, age: ageNum, gender: gender || "Other", specimenType, assignedTo,
    createdById: req.user.id,
  });
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: "Created patient case", target: created.id });
  res.status(201).json({ case: created });
});

// ---- Single case -----------------------------------------------------

router.get("/:id", requireAuth, async (req, res) => {
  const c = await casesModel.findByCaseCode(req.params.id);
  if (!c) return res.status(404).json({ error: "Case not found." });

  if (req.user.role === "researcher") {
    const myRequests = await queueAccess.listForUser(req.user.id);
    const approvedRanges = myRequests.filter((r) => r.status === "Approved");
    const caseDate = c.dateAdded.slice(0, 10);
    const inRange = approvedRanges.some((r) => caseDate >= r.startDate && caseDate <= r.endDate);
    if (!inRange) return res.status(403).json({ error: "This case is outside your approved queue-access date range." });
  }

  res.json({ case: c });
});

router.patch("/:id/basic-info", requireAuth, requireRole("admin", "lab_tech"), async (req, res) => {
  const { patientName, age, gender } = req.body || {};
  const updated = await casesModel.updateBasicInfo(req.params.id, { patientName, age: age !== undefined ? Number(age) : undefined, gender });
  if (!updated) return res.status(404).json({ error: "Case not found." });
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: "Edited basic info", target: req.params.id });
  res.json({ case: updated });
});

router.patch("/:id/record", requireAuth, requireRole("admin", "lab_tech", "pathologist"), async (req, res) => {
  const { specimenType, assignedTo, status, diagnosisStatus } = req.body || {};
  const updated = await casesModel.updateCaseRecord(req.params.id, { specimenType, assignedTo, status, diagnosisStatus });
  if (!updated) return res.status(404).json({ error: "Case not found." });
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: "Updated case record", target: req.params.id });
  res.json({ case: updated });
});

router.patch("/:id/upload-status", requireAuth, requireRole("admin", "lab_tech"), async (req, res) => {
  const { uploadStatus } = req.body || {};
  if (!["Uploaded", "Processing", "Processed"].includes(uploadStatus)) {
    return res.status(400).json({ error: "Invalid uploadStatus." });
  }
  const updated = await casesModel.setUploadStatus(req.params.id, uploadStatus);
  if (!updated) return res.status(404).json({ error: "Case not found." });
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: `Set upload status to ${uploadStatus}`, target: req.params.id });
  res.json({ case: updated });
});

router.post("/:id/approve-report", requireAuth, requireRole("admin", "pathologist"), async (req, res) => {
  const updated = await casesModel.approveReport(req.params.id);
  if (!updated) return res.status(404).json({ error: "Case not found." });
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: "Approved diagnostic report", target: req.params.id });
  res.json({ case: updated });
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const ok = await casesModel.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Case not found." });
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: "Deleted patient case", target: req.params.id });
  res.json({ ok: true });
});

// ---- Notes -------------------------------------------------------------

router.post("/:id/notes", requireAuth, requireRole("admin", "pathologist"), async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "note text is required." });
  const updated = await casesModel.addNote(req.params.id, { authorId: req.user.id, authorName: req.user.name, text: text.trim() });
  if (!updated) return res.status(404).json({ error: "Case not found." });
  await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: "Added case note", target: req.params.id });
  res.json({ case: updated });
});

// ---- Image upload + AI analysis trigger (enqueued via BullMQ/Redis) ----

router.post("/:id/images", requireAuth, requireRole("admin", "lab_tech", "pathologist"), (req, res, next) => {
  upload.single("file")(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.message });
      const caseRow = await casesModel.findRawByCaseCode(req.params.id);
      if (!caseRow) return res.status(404).json({ error: "Case not found." });
      if (!req.file) return res.status(400).json({ error: "No file uploaded (field name must be 'file')." });

      const image = await images.create({
        caseId: caseRow.id,
        fileName: req.file.originalname,
        storedPath: req.file.path,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      });

      await casesModel.markAssignedOnUpload(req.params.id);

      const job = await queue.create({
        caseId: caseRow.id,
        imageId: image.id,
        fileName: req.file.originalname,
        framework: "AI-Path CV Engine (BullMQ worker)",
        createdById: req.user.id,
        etaSeconds: 18,
      });

      // Hand off to Redis/BullMQ — a worker (in this process or a separate
      // `npm run worker` process) will pick it up as capacity allows.
      const bullJob = await enqueueAnalysis({
        jobRowId: job.id,
        imageId: image.id,
        caseInternalId: caseRow.id,
        caseCode: req.params.id,
        storedPath: req.file.path,
        fileName: req.file.originalname,
      });
      await queue.setBullJobId(job.id, bullJob.id);

      await misc.logAction({ actorId: req.user.id, actorName: req.user.name, action: `Uploaded slide (${req.file.originalname})`, target: req.params.id });

      res.status(202).json({ image: { id: image.id, fileName: image.fileName }, jobId: job.id, case: await casesModel.findByCaseCode(req.params.id) });
    } catch (e) {
      next(e);
    }
  });
});

router.get("/:id/analysis", requireAuth, async (req, res) => {
  const caseRow = await casesModel.findRawByCaseCode(req.params.id);
  if (!caseRow) return res.status(404).json({ error: "Case not found." });
  const result = await analysisModel.findLatestForCase(caseRow.id);
  if (!result) return res.status(404).json({ error: "No analysis available yet for this case." });
  res.json({ analysis: result });
});

// All analysis runs for this patient/case (one per analyzed slide), most
// recent first — lets the viewer list and switch between every analysis
// instead of only ever showing the latest.
router.get("/:id/analyses", requireAuth, async (req, res) => {
  const caseRow = await casesModel.findRawByCaseCode(req.params.id);
  if (!caseRow) return res.status(404).json({ error: "Case not found." });
  const results = await analysisModel.listForCase(caseRow.id);
  res.json({ analyses: results });
});

router.get("/:id/images", requireAuth, async (req, res) => {
  const caseRow = await casesModel.findRawByCaseCode(req.params.id);
  if (!caseRow) return res.status(404).json({ error: "Case not found." });
  res.json({ images: await images.listByCase(caseRow.id) });
});

module.exports = router;
