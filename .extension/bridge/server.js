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

// Import modular components
const config = require("./config");
const ptyBridge = require("./src/pty");
const apiRoutes = require("./src/api");
const { fileWatcher } = require("./src/services");

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
  // Reconnection is handled client-side, but allow it
  allowEIO3: true,
});

// Track server state for health monitoring
let serverReady = false;
let ptyInitialized = false;
let lastPtyError = null;

// =============================================================================
// Middleware Configuration
// =============================================================================

// Serve static files from public directory (development mode - no caching)
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
  })
);

app.get(
  "/api/resilience/errors",
  errorHandler.safeRoute((req, res) => {
    const count = parseInt(req.query.count) || 50;
    res.json({
      errors: errorHandler.getRecentErrors(count),
    });
  })
);

app.post(
  "/api/resilience/errors/clear",
  errorHandler.safeRoute((req, res) => {
    errorHandler.clearErrors();
    res.json({ success: true, message: "Error log cleared" });
  })
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
  })
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
  socket.on(
    "serial-data",
    errorHandler.safeSocketHandler((data) => {
      processGuard.recordActivity();
      ptyBridge.write(data);
    }, "serial-data")
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
        }/${MAX_RETRIES})`
      );
      setTimeout(() => initializePtyWithRecovery(retryCount + 1), RETRY_DELAY);
    } else {
      console.log(
        "[server] PTY bridge failed after retries - running without PTY forwarding"
      );
      ptyInitialized = false;
    }
  }
}

// =============================================================================
// Health Monitor Setup
// =============================================================================

// Configure health monitoring with PTY recovery
healthMonitor.onHeal("onPtyFailure", async (ptyStatus) => {
  console.log("[server] Health monitor triggered PTY recovery");
  try {
    ptyBridge.shutdown();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await initializePtyWithRecovery();
  } catch (err) {
    errorHandler.logError("PTY_RECOVERY", err);
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
    console.log(`[server] ✅ Bridge server running on port ${actualPort}`);
    console.log(
      `[server] Open the 'Ports' tab in VS Code to access the web interface.`
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

  // Handle server errors
  server.on("error", (err) => {
    errorHandler.logError("SERVER_ERROR", err);

    if (err.code === "EADDRINUSE") {
      console.log(`[server] Port ${actualPort} in use - will retry...`);
      setTimeout(() => {
        server.close();
        startServer();
      }, 5000);
    }
  });
}

// Start the server
startServer().catch((err) => {
  errorHandler.logError("STARTUP_ERROR", err);
  console.error("[server] Startup failed:", err.message);
  // Don't exit - let the error handlers keep us alive for debugging
});
