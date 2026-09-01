require("dotenv").config();
const { Worker } = require("bullmq");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

process.on("unhandledRejection", (err) => {
  // eslint-disable-next-line no-console
  console.error("[worker] Unhandled rejection (non-fatal, logged to keep the pipeline alive):", err);
});

const { createConnection } = require("./connection");
const { QUEUE_NAME } = require("./analysisQueue");
const queueModel = require("../models/queue");
const analysisModel = require("../models/analysis");
const casesModel = require("../models/cases");
const misc = require("../models/misc");
const { resolvePython } = require("../lib/resolvePython");
const socketServer = require("../lib/socketServer");

const AI_SCRIPT = path.join(__dirname, "..", "..", "ai", "analyze.py");
const OUTPUT_DIR = path.join(__dirname, "..", "..", "uploads", "analysis");
// Limits how many slides are analyzed in parallel — mirrors a real deployment
// where inference workers are bound by finite GPU/CPU capacity. Extra uploads
// simply queue in Redis until a slot frees up.
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 2);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function runPython(storedPath, caseCode, jobRowId, fileName, onProgress) {
  return new Promise((resolve, reject) => {
    let python;
    try {
      python = resolvePython();
    } catch (err) {
      reject(err);
      return;
    }

    const child = spawn(python.bin, [...python.args, AI_SCRIPT, storedPath, OUTPUT_DIR, caseCode], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    let progress = 5;
    const tick = setInterval(() => {
      progress = Math.min(92, progress + Math.random() * 12 + 4);
      const pct = Math.round(progress);
      // emit real-time progress to all connected browser clients
      socketServer.emitJobProgress({
        jobId: jobRowId,
        caseId: caseCode,
        fileName,
        status: "active",
        progress: pct,
        eta: `${String(Math.floor(Math.max(0, 18 - pct / 6))).padStart(2, "0")}:${String(Math.round((Math.max(0, 18 - pct / 6) % 1) * 60)).padStart(2, "0")}`,
      });
      Promise.resolve(queueModel.update(jobRowId, { progress: pct, etaSeconds: Math.round(Math.max(2, 18 - pct / 6)) })).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[worker] progress update failed (non-fatal):", err.message);
      });
    }, 450);

    child.on("close", (code) => {
      clearInterval(tick);
      if (code !== 0) {
        reject(new Error(stderr.slice(0, 400) || "Analysis process exited with an error."));
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(stdout.trim().split("\n").pop());
      } catch (err) {
        reject(new Error("Could not parse analysis output."));
        return;
      }
      if (parsed.error) {
        reject(new Error(parsed.error.slice(0, 400)));
        return;
      }
      resolve(parsed);
    });

    child.on("error", (err) => {
      clearInterval(tick);
      if (err.code === "ENOENT") {
        reject(new Error(`Could not launch Python interpreter "${python.bin}" (${err.code}). It passed the startup check but disappeared — check your PATH/venv. Original error: ${err.message}`));
      } else {
        reject(err);
      }
    });
  });
}

async function processJob(job) {
  const { jobRowId, imageId, caseInternalId, caseCode, storedPath, fileName } = job.data;

  await queueModel.update(jobRowId, { status: "active", progress: 5, etaSeconds: 18 });
  await job.updateProgress(5);
  socketServer.emitJobProgress({ jobId: jobRowId, caseId: caseCode, fileName, status: "active", progress: 5, eta: "--:--" });

  let parsed;
  try {
    // runPython now emits progress directly via socketServer inside the tick;
    // we pass a lightweight callback just for BullMQ's internal progress tracking.
    parsed = await runPython(storedPath, caseCode, jobRowId, fileName, async (pct) => {
      await job.updateProgress(pct);
    });
  } catch (err) {
    await queueModel.update(jobRowId, { status: "failed", progress: 0, errorMsg: err.message.slice(0, 600) });
    await casesModel.updateCaseRecord(caseCode, { status: "Failed" });
    await misc.logAction({ actorName: "System", action: "AI analysis failed", target: caseCode });
    socketServer.emitJobDone({ jobId: jobRowId, caseId: caseCode, fileName, status: "failed", errorMsg: err.message });
    socketServer.emitCaseUpdated(caseCode, { status: "Failed" });
    throw err; // let BullMQ record this job as failed too
  }

  await analysisModel.save({
    imageId,
    caseId: caseInternalId,
    metrics: parsed.metrics,
    boxes: parsed.boxes,
    tags: parsed.tags,
    heatmapPath: `analysis/${parsed.heatmapFile}`,
    overlayPath: `analysis/${parsed.slideFile}`,
    thumbnailPath: `analysis/${parsed.thumbnailFile}`,
  });

  await queueModel.update(jobRowId, { status: "done", progress: 100, etaSeconds: 0 });
  await job.updateProgress(100);

  const caseRow = await casesModel.findRawByCaseCode(caseCode);
  await casesModel.setUploadStatus(caseCode, "Processed");
  await casesModel.updateCaseRecord(caseCode, {
    status: "Completed",
    diagnosisStatus: caseRow && caseRow.diagnosis_status === "Completed" ? "Completed" : "Pending",
  });
  await misc.logAction({ actorName: "System", action: "AI inference completed", target: caseCode });

  // Push real-time events to all connected clients.
  socketServer.emitJobDone({ jobId: jobRowId, caseId: caseCode, fileName, status: "done" });
  socketServer.emitCaseUpdated(caseCode, { status: "Completed", uploadStatus: "Processed" });

  return { ok: true };
}

function startWorker() {
  try {
    resolvePython();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`\n[worker] WARNING — AI analysis will fail until this is fixed:\n${err.message}\n`);
  }

  const worker = new Worker(QUEUE_NAME, processJob, {
    connection: createConnection(),
    concurrency: CONCURRENCY,
  });

  worker.on("completed", (job) => {
    // eslint-disable-next-line no-console
    console.log(`[worker] job ${job.id} (${job.data.fileName}) completed`);
  });
  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[worker] job ${job?.id} (${job?.data?.fileName}) failed:`, err.message);
  });
  worker.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[worker] Redis/worker error:", err.message);
  });

  // eslint-disable-next-line no-console
  console.log(`AI-Path analysis worker started (concurrency=${CONCURRENCY})`);
  return worker;
}

if (require.main === module) {
  startWorker();
}

module.exports = { startWorker };
