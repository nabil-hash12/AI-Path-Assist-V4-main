const IORedis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function createConnection() {
  // maxRetriesPerRequest must be null for BullMQ's blocking connections.
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

module.exports = { createConnection, REDIS_URL };
