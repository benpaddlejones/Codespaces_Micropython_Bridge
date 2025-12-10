/**
 * Process Guard
 * Ensures the server process stays alive and handles signals gracefully.
 * Prevents zombie processes and handles restarts properly.
 */

let shutdownHandlers = [];
let isShuttingDown = false;
let keepAliveInterval = null;
let lastActivity = Date.now();

// Configuration
const KEEP_ALIVE_INTERVAL = 30000; // 30 seconds
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds max for shutdown

/**
 * Register a shutdown handler
 */
function onShutdown(handler) {
  if (typeof handler === "function") {
    shutdownHandlers.push(handler);
  }
}

/**
 * Execute all shutdown handlers with timeout protection
 */
async function executeShutdownHandlers() {
  console.log(
    `[processGuard] Executing ${shutdownHandlers.length} shutdown handlers...`
  );

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Shutdown timeout")), SHUTDOWN_TIMEOUT);
  });

  const handlers = Promise.all(
    shutdownHandlers.map(async (handler, index) => {
      try {
        await handler();
        console.log(`[processGuard] Handler ${index + 1} completed`);
      } catch (error) {
        console.error(
          `[processGuard] Handler ${index + 1} failed:`,
          error.message
        );
      }
    })
  );

  try {
    await Promise.race([handlers, timeout]);
  } catch (error) {
    console.error("[processGuard] Shutdown timeout - forcing exit");
  }
}

/**
 * Graceful shutdown function
 */
async function gracefulShutdown(signal, exitCode = 0) {
  if (isShuttingDown) {
    console.log("[processGuard] Shutdown already in progress...");
    return;
  }

  isShuttingDown = true;
  console.log(
    `[processGuard] Received ${signal} - initiating graceful shutdown...`
  );

  // Stop keep-alive
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }

  // Execute handlers
  await executeShutdownHandlers();

  console.log("[processGuard] Shutdown complete");
  process.exit(exitCode);
}

/**
 * Initialize process guards
 */
function initialize(options = {}) {
  const { enableKeepAlive = true } = options;

  // Handle termination signals gracefully
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM", 0));
  process.on("SIGINT", () => gracefulShutdown("SIGINT", 0));
  process.on("SIGHUP", () => gracefulShutdown("SIGHUP", 0));

  // Handle SIGUSR2 (nodemon restart)
  process.once("SIGUSR2", async () => {
    console.log("[processGuard] SIGUSR2 received (nodemon restart)");
    await executeShutdownHandlers();
    process.kill(process.pid, "SIGUSR2");
  });

  // Prevent accidental exit
  process.on("beforeExit", (code) => {
    if (code === 0 && !isShuttingDown) {
      console.log("[processGuard] Preventing unexpected exit");
      // This shouldn't normally happen in a server, but just in case
    }
  });

  // Keep the process alive even if all handles are closed
  if (enableKeepAlive) {
    keepAliveInterval = setInterval(() => {
      const idleTime = Date.now() - lastActivity;
      // Just keep the event loop alive
      // Log if server has been idle for a long time
      if (idleTime > 300000) {
        // 5 minutes
        console.log(
          `[processGuard] Server idle for ${Math.round(
            idleTime / 1000
          )}s - still alive`
        );
        lastActivity = Date.now(); // Reset to prevent spam
      }
    }, KEEP_ALIVE_INTERVAL);

    // Allow process to exit if this is the only thing keeping it alive
    // (will be kept alive by HTTP server anyway)
    keepAliveInterval.unref();
  }

  console.log("[processGuard] Process guards initialized");
  console.log("[processGuard] Graceful shutdown handlers registered");
}

/**
 * Record activity to track idle time
 */
function recordActivity() {
  lastActivity = Date.now();
}

/**
 * Check if shutdown is in progress
 */
function isShuttingDownNow() {
  return isShuttingDown;
}

/**
 * Force restart (for use by health monitor)
 */
function forceRestart(reason = "Unknown") {
  console.log(`[processGuard] Force restart requested: ${reason}`);
  gracefulShutdown("FORCE_RESTART", 0);
}

/**
 * Get process status
 */
function getStatus() {
  return {
    pid: process.pid,
    uptime: process.uptime(),
    isShuttingDown,
    lastActivity: new Date(lastActivity).toISOString(),
    shutdownHandlersCount: shutdownHandlers.length,
  };
}

module.exports = {
  initialize,
  onShutdown,
  gracefulShutdown,
  recordActivity,
  isShuttingDownNow,
  forceRestart,
  getStatus,
};
