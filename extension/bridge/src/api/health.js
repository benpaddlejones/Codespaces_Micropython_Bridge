/**
 * Health check API routes.
 * Provides server status and diagnostic information.
 */

const express = require("express");
const ptyBridge = require("../pty");

const router = express.Router();

/**
 * GET /api/health
 * Returns server health status including uptime and PTY status
 */
router.get("/health", (req, res) => {
  const ptyStatus = ptyBridge.getStatus();

  res.json({
    status: "ok",
    uptime: process.uptime(),
    ...ptyStatus,
  });
});

module.exports = router;
