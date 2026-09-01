const { Queue } = require("bullmq");
const { createConnection } = require("./connection");

const QUEUE_NAME = "slide-analysis";

const analysisQueue = new Queue(QUEUE_NAME, {
  connection: createConnection(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100, age: 24 * 3600 },
    removeOnFail: { count: 100, age: 24 * 3600 },
  },
});

/**
 * Enqueue a slide for AI analysis. The actual work happens in the Worker
 * (src/queue/worker.js), which may run in this same process or as a fully
 * separate `npm run worker` process for horizontal scaling — BullMQ decouples
 * job submission from execution via Redis, so either topology works
 * unchanged.
 */
async function enqueueAnalysis({ jobRowId, imageId, caseInternalId, caseCode, storedPath, fileName }) {
  const job = await analysisQueue.add(
    "analyze-slide",
    { jobRowId, imageId, caseInternalId, caseCode, storedPath, fileName },
    { jobId: jobRowId }
  );
  return job;
}

module.exports = { analysisQueue, enqueueAnalysis, QUEUE_NAME };
