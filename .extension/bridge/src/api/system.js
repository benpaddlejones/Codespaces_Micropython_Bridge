/**
 * System API routes.
 * Handles server control operations like restart.
 */

const express = require("express");
const ptyBridge = require("../pty");

const router = express.Router();

// Keep track of shutdown handler (injected from server.js)
let shutdownHandler = null;

/**
 * Sets the shutdown handler for graceful restart.
 * @param {function} handler - Function to call during shutdown
 */
function setShutdownHandler(handler) {
  shutdownHandler = handler;
}

/**
 * POST /api/restart
 * Triggers server restart (expects process manager to restart)
 */
router.post("/restart", (req, res) => {
  console.log("[api/system] Restart requested via API");
  res.json({ success: true, message: "Restarting server..." });

  // Clean up and exit after response is sent
  setTimeout(() => {
    console.log("[api/system] Executing restart...");

    // Shutdown PTY bridge
    ptyBridge.shutdown();

    // Call additional shutdown handler if provided
    if (shutdownHandler) {
      shutdownHandler();
    }

    // Exit with code 0 so process managers know it was intentional
    process.exit(0);
  }, 500);
});

module.exports = router;
module.exports.setShutdownHandler = setShutdownHandler;
