const { Server } = require("socket.io");

let io = null;

/**
 * Initialise Socket.IO on an existing http.Server instance.
 * Called once from server.js after the Express server starts listening.
 */
function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
    // Use long-polling as fallback so it works behind simple reverse proxies
    // that don't support WebSocket upgrades.
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    // eslint-disable-next-line no-console
    console.log(`[socket.io] client connected: ${socket.id}`);

    // Clients join a named room for each case they're viewing so we can
    // target events precisely instead of broadcasting to everyone.
    socket.on("join:case", (caseCode) => {
      if (caseCode) socket.join(`case:${caseCode}`);
    });

    socket.on("leave:case", (caseCode) => {
      if (caseCode) socket.leave(`case:${caseCode}`);
    });

    socket.on("disconnect", () => {
      // eslint-disable-next-line no-console
      console.log(`[socket.io] client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/** Retrieve the initialised io instance (throws if init() was never called). */
function getIO() {
  if (!io) throw new Error("Socket.IO has not been initialised — call init(httpServer) first.");
  return io;
}

// ─── Typed event emitters ─────────────────────────────────────────────────

/** Broadcast a queue job progress update to all connected clients. */
function emitJobProgress({ jobId, caseId, fileName, status, progress, eta }) {
  if (!io) return;
  io.emit("job:progress", { jobId, caseId, fileName, status, progress, eta });
}

/** Broadcast job completion (or failure) to all clients + the specific case room. */
function emitJobDone({ jobId, caseId, fileName, status, errorMsg }) {
  if (!io) return;
  io.emit("job:done", { jobId, caseId, fileName, status, errorMsg });
  if (caseId) io.to(`case:${caseId}`).emit("analysis:ready", { caseId });
}

/** Notify clients in a case room that the case record has changed. */
function emitCaseUpdated(caseCode, partialCase) {
  if (!io) return;
  io.to(`case:${caseCode}`).emit("case:updated", { caseCode, ...partialCase });
  // Also broadcast globally so the patients list / dashboard refreshes.
  io.emit("cases:changed", { caseCode });
}

module.exports = { init, getIO, emitJobProgress, emitJobDone, emitCaseUpdated };
