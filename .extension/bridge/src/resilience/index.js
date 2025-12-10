/**
 * Resilience Module
 * Provides comprehensive error handling, self-healing, and high availability
 * for the Pi Pico Bridge server.
 */

const errorHandler = require("./errorHandler");
const healthMonitor = require("./healthMonitor");
const processGuard = require("./processGuard");
const portManager = require("./portManager");

module.exports = {
  errorHandler,
  healthMonitor,
  processGuard,
  portManager,
};
