/**
 * Pi Pico Bridge Server
 *
 * A HIGHLY AVAILABLE, SELF-HEALING modular Express server that bridges
 * Web Serial from the browser to a PTY for mpremote access in GitHub Codespaces.
 *
 * Architecture:
 * - config/         - Centralized configuration
 * - src/api/        - REST API routes
 * - src/pty/        - PTY bridge management (socat + SerialPort)
 * - src/services/   - File system services
 * - src/utils/      - Utilities (logging, etc.)
 * - src/resilience/ - High availability & self-healing
 *
 * RESILIENCE FEATURES:
 * - Never crashes on uncaught exceptions or unhandled rejections
 * - Self-heals memory issues with automatic GC
 * - Auto-recovers PTY bridge on failure
 * - Port conflict resolution (kills stale processes)
 * - Graceful shutdown with timeout protection
 * - Health monitoring with automatic recovery
 * - Circuit breaker pattern for external operations
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

// Import modular components
const config = require("./config");
const ptyBridge = require("./src/pty");
const apiRoutes = require("./src/api");
const { fileWatcher } = require("./src/services");
const { createCacheBustMiddleware } = require("./src/middleware/cacheBust");
const {
  createSecurityMiddleware,
  createSocketOriginGuard,
} = require("./src/middleware/security");

// Read version from the extension's package.json so the UI always shows
// the real installed version (instead of a hardcoded literal that drifts).
// Generate a build token at server startup so every reload of the
// extension host / VS Code window invalidates every browser-side asset URL.
let BRIDGE_VERSION = "0.0.0";
try {
  BRIDGE_VERSION = require("../package.json").version || "0.0.0";
} catch (_err) {
  // package.json may not be resolvable in some packaged contexts; fall
  // back to "0.0.0" rather than crashing the bridge.
}
const BRIDGE_BUILD_TOKEN = String(Date.now());

// Import resilience modules for high availability
const {
  errorHandler,
  healthMonitor,
  processGuard,
  portManager,
} = require("./src/resilience");

// =============================================================================
// RESILIENCE INITIALIZATION (Must be FIRST!)
// =============================================================================

// Initialize global error handlers - prevents ALL crashes
errorHandler.initialize({
  exitOnFatal: false, // NEVER exit on errors
  onError: (error) => {
    console.log("[server] Error caught and handled - server continues");
  },
});

// Initialize process guards for graceful shutdown
processGuard.initialize({
  enableKeepAlive: true,
});

// Initialize Express app and Socket.io
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Socket.io resilience settings
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e6,
});

// Reject cross-site socket handshakes (mirrors the REST origin check) so a
// malicious page cannot open a socket and write to the connected device.
io.use(createSocketOriginGuard());

// Track server state for health monitoring
let serverReady = false;
let ptyInitialized = false;
let lastPtyError = null;

// Single-writer guarantee: only one connected browser tab may write to the
// PTY at a time, otherwise two tabs both drive the one mpremote REPL and
// produce interleaved/garbled input. The first tab to send data becomes the
// controller; others are read-only until it disconnects.
let activeControllerId = null;

// =============================================================================
// Middleware Configuration
// =============================================================================

// Serve static files from public directory (development mode - no caching)
// First: security headers + cross-site (CSRF) protection on every request.
app.use(createSecurityMiddleware());
// Next: cache-bust middleware rewrites HTML/JS to append ?v=<BUILD_TOKEN>
// to every local asset URL and ES module import. This guarantees the
// browser never serves a stale module graph after a server restart.
app.use(
  createCacheBustMiddleware({
    publicDir: config.paths.publicDir,
    buildToken: BRIDGE_BUILD_TOKEN,
    version: BRIDGE_VERSION,
  }),
);
app.use(express.static(config.paths.publicDir, config.staticOptions));
app.use(express.json());

// Request logging for activity tracking
app.use((req, res, next) => {
  processGuard.recordActivity();
  next();
});

// =============================================================================
// API Routes Registration
// =============================================================================

apiRoutes.registerRoutes(app);

// Version + build-token endpoint for the bridge UI.
app.get("/api/version", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    version: BRIDGE_VERSION,
    buildToken: BRIDGE_BUILD_TOKEN,
    startedAt: new Date(Number(BRIDGE_BUILD_TOKEN)).toISOString(),
  });
});

// Add resilience diagnostic endpoints
app.get(
  "/api/resilience",
  errorHandler.safeRoute((req, res) => {
    res.json({
      status: "resilient",
      health: healthMonitor.getLastCheck(),
      process: processGuard.getStatus(),
      errors: {
        recent: errorHandler.getRecentErrors(10),
      },
    });
  }),
);

app.get(
  "/api/resilience/errors",
  errorHandler.safeRoute((req, res) => {
    const count = parseInt(req.query.count) || 50;
    res.json({
      errors: errorHandler.getRecentErrors(count),
    });
  }),
);

app.post(
  "/api/resilience/errors/clear",
  errorHandler.safeRoute((req, res) => {
    errorHandler.clearErrors();
    res.json({ success: true, message: "Error log cleared" });
  }),
);

app.get(
  "/api/resilience/health",
  errorHandler.safeRoute((req, res) => {
    const history = parseInt(req.query.history) || 20;
    res.json({
      current: healthMonitor.getLastCheck(),
      history: healthMonitor.getHistory(history),
      healthy: healthMonitor.isHealthy(),
    });
  }),
);

// Error handling middleware (must be after routes)
app.use(errorHandler.expressErrorMiddleware);

// =============================================================================
// File Watcher Setup (with error protection)
// =============================================================================

try {
  fileWatcher.start((filename, eventType) => {
    try {
      io.emit("files-changed", { file: filename, event: eventType });
    } catch (err) {
      errorHandler.logError("FILE_WATCHER_EMIT", err, { filename, eventType });
    }
  });
} catch (err) {
  errorHandler.logError("FILE_WATCHER_START", err);
  console.log("[server] File watcher failed to start - continuing without it");
}

// =============================================================================
// Socket.io Connection Handling (with error protection)
// =============================================================================

io.on("connection", (socket) => {
  console.log("[socket] Browser client connected");
  processGuard.recordActivity();

  // Send initial status
  try {
    const ptyStatus = ptyBridge.getStatus();
    if (ptyStatus.ptyReady && ptyStatus.linkExists) {
      socket.emit("status", `PTY Bridge Active: ${ptyStatus.linkPath}`);
    } else {
      socket.emit("status", "Direct Web Serial mode (PTY not available)");
    }
  } catch (err) {
    errorHandler.logError("SOCKET_INIT_STATUS", err, { silent: true });
    socket.emit("status", "Server running (status check failed)");
  }

  // Data from Pico (via browser) -> PTY (for mpremote in Codespace)
  let warnedReadOnly = false;
  // Cap a single serial payload well under the socket's maxHttpBufferSize so a
  // buggy/hostile client cannot flood the PTY in one message.
  const MAX_SERIAL_CHUNK = 64 * 1024;
  socket.on(
    "serial-data",
    errorHandler.safeSocketHandler((data) => {
      processGuard.recordActivity();

      // Validate at the boundary: only forward reasonably-sized strings to the
      // PTY. Non-string/oversized payloads are dropped rather than trusted.
      if (typeof data !== "string" || data.length === 0) {
        return;
      }
      if (data.length > MAX_SERIAL_CHUNK) {
        data = data.slice(0, MAX_SERIAL_CHUNK);
      }

      // Enforce a single active writer. The first tab to send claims control;
      // any other tab's writes are dropped (read-only) to avoid garbling the
      // shared REPL.
      if (activeControllerId === null) {
        activeControllerId = socket.id;
      }
      if (activeControllerId !== socket.id) {
        if (!warnedReadOnly) {
          warnedReadOnly = true;
          socket.emit(
            "status",
            "Read-only: another tab is controlling the device.",
          );
        }
        return;
      }

      ptyBridge.write(data);
    }, "serial-data"),
  );

  // Data from PTY (mpremote in Codespace) -> Browser -> Pico
  let removeDataHandler = () => {};
  try {
    removeDataHandler = ptyBridge.onData((data) => {
      try {
        socket.emit("serial-data", data.toString());
      } catch (err) {
        errorHandler.logError("SOCKET_EMIT_DATA", err, { silent: true });
      }
    });
  } catch (err) {
    errorHandler.logError("PTY_DATA_HANDLER", err);
  }

  socket.on("disconnect", () => {
    console.log("[socket] Browser client disconnected");
    // Release control so another tab can take over.
    if (activeControllerId === socket.id) {
      activeControllerId = null;
    }
    try {
      removeDataHandler();
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  // Handle socket errors gracefully
  socket.on("error", (err) => {
    errorHandler.logError("SOCKET_ERROR", err, { silent: true });
  });
});

// =============================================================================
// Graceful Shutdown (with resilience)
// =============================================================================

function shutdown() {
  console.log("[server] Shutting down...");
  try {
    fileWatcher.stop();
  } catch (err) {
    console.error("[server] File watcher stop error:", err.message);
  }
  try {
    ptyBridge.shutdown();
  } catch (err) {
    console.error("[server] PTY shutdown error:", err.message);
  }
  try {
    healthMonitor.stop();
  } catch (err) {
    console.error("[server] Health monitor stop error:", err.message);
  }
}

// Register shutdown with process guard
processGuard.onShutdown(shutdown);

// Keep SIGINT handler for direct interrupts (PM2 handles this differently)
process.on("SIGINT", () => {
  // Process guard will handle this
});

// Register shutdown handler with API routes (for /api/restart)
apiRoutes.setShutdownHandler(() => {
  try {
    fileWatcher.stop();
  } catch (err) {
    // Ignore
  }
});

// =============================================================================
// PTY Self-Healing Setup
// =============================================================================

/**
 * Initialize PTY with automatic recovery on failure
 */
async function initializePtyWithRecovery(retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000;

  try {
    await ptyBridge.initialize();
    ptyInitialized = true;
    lastPtyError = null;
    console.log("[server] PTY bridge initialized successfully");
  } catch (err) {
    lastPtyError = err;
    errorHandler.logError("PTY_INIT", err);

    if (retryCount < MAX_RETRIES) {
      console.log(
        `[server] PTY init failed, retrying in ${RETRY_DELAY}ms (${
          retryCount + 1
        }/${MAX_RETRIES})`,
      );
      // Await the retry chain so callers (startup, health-monitor heal) only
      // resolve once recovery has genuinely finished or given up.
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return initializePtyWithRecovery(retryCount + 1);
    } else {
      console.log(
        "[server] PTY bridge failed after retries - running without PTY forwarding",
      );
      ptyInitialized = false;
    }
  }
}

// =============================================================================
// Health Monitor Setup
// =============================================================================

// Configure health monitoring with PTY recovery
let ptyRecoveryInProgress = false;
healthMonitor.onHeal("onPtyFailure", async (ptyStatus) => {
  // A recovery cycle (shutdown + up to 3 retries x 5s) can outlast the 15s
  // health-check interval; without this guard, overlapping heals repeatedly
  // tear down socat mid-recovery and the PTY never stabilises.
  if (ptyRecoveryInProgress) {
    console.log("[server] PTY recovery already in progress - skipping");
    return;
  }
  ptyRecoveryInProgress = true;
  console.log("[server] Health monitor triggered PTY recovery");
  try {
    ptyBridge.shutdown();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await initializePtyWithRecovery();
  } catch (err) {
    errorHandler.logError("PTY_RECOVERY", err);
  } finally {
    ptyRecoveryInProgress = false;
  }
});

healthMonitor.onHeal("onMemoryCritical", (metrics) => {
  console.log(`[server] Memory critical: ${metrics.memory.heapUsed}MB`);
  // GC is handled by healthMonitor if --expose-gc is available
});

// =============================================================================
// Server Startup (with resilience)
// =============================================================================

const { port, host } = config.server;

async function startServer() {
  console.log("=".repeat(60));
  console.log("  Pi Pico Bridge Server - HIGH AVAILABILITY MODE");
  console.log("=".repeat(60));
  console.log("[server] Resilience features: ENABLED");
  console.log("[server] Crash protection: ACTIVE");
  console.log("[server] Self-healing: ACTIVE");
  console.log("=".repeat(60));

  // Ensure port is available (kill any stale processes)
  const portAvailable = await portManager.ensurePortAvailable(port, {
    forceKill: true,
  });

  if (!portAvailable) {
    console.log(`[server] Port ${port} still blocked, attempting wait...`);
    const success = await portManager.waitForPort(port, {
      maxAttempts: 5,
      retryDelay: 2000,
      forceKill: true,
    });

    if (!success) {
      console.error(`[server] FATAL: Cannot bind to port ${port}`);
      console.log("[server] Trying alternative port...");

      // Try to find alternative port
      try {
        const altPort = await portManager.getAvailablePort(port, 10);
        console.log(`[server] Using alternative port: ${altPort}`);
        config.server.port = altPort;
      } catch (err) {
        console.error("[server] No available ports found");
        // Don't exit - let PM2 restart us
        return;
      }
    }
  }

  const actualPort = config.server.port;

  server.listen(actualPort, host, async () => {
    serverReady = true;
    // Machine-readable port line so the extension host can learn the real
    // port even when an alternative port had to be chosen (avoids the
    // extension polling/opening the wrong port).
    console.log(`PICO_BRIDGE_PORT=${actualPort}`);
    console.log(`[server] ✅ Bridge server running on port ${actualPort}`);
    console.log(
      `[server] Open the 'Ports' tab in VS Code to access the web interface.`,
    );

    // Initialize PTY bridge with recovery
    await initializePtyWithRecovery();

    // Start health monitoring
    healthMonitor.start({
      interval: 15000, // Check every 15 seconds
      getContext: () => ({
        ptyStatus: {
          ...ptyBridge.getStatus(),
          shouldBeReady: ptyInitialized,
        },
      }),
    });

    console.log("[server] Health monitoring: ACTIVE");
    console.log("[server] Server is ready for connections");
    console.log("=".repeat(60));
  });
}

// Handle server errors. Registered ONCE at module scope: startServer() is
// re-entered on retry, so registering inside it would stack a fresh listener
// (each with its own retry counter) on every attempt - one error event would
// then schedule multiple compounding retries.
let serverRetryCount = 0;
const MAX_SERVER_RETRIES = 3;

server.on("error", (err) => {
  errorHandler.logError("SERVER_ERROR", err);

  if (err.code === "EADDRINUSE") {
    const currentPort = config.server.port;
    serverRetryCount++;
    if (serverRetryCount <= MAX_SERVER_RETRIES) {
      console.log(
        `[server] Port ${currentPort} in use - retry ${serverRetryCount}/${MAX_SERVER_RETRIES}...`,
      );
      setTimeout(() => {
        server.close();
        startServer();
      }, 5000);
    } else {
      console.error(
        `[server] Port ${currentPort} still in use after ${MAX_SERVER_RETRIES} retries - giving up`,
      );
    }
  }
});

// Start the server
startServer().catch((err) => {
  errorHandler.logError("STARTUP_ERROR", err);
  console.error("[server] Startup failed:", err.message);
  // Don't exit - let the error handlers keep us alive for debugging
});
