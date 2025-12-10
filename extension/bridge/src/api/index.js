/**
 * API Routes index.
 * Aggregates all API route modules.
 */

const filesRoutes = require("./files");
const healthRoutes = require("./health");
const systemRoutes = require("./system");
const firmwareRoutes = require("./firmware");
const esptoolRoutes = require("./esptool");

/**
 * Registers all API routes on the Express app.
 *
 * @param {Express} app - Express application instance
 */
function registerRoutes(app) {
  app.use("/api", filesRoutes);
  app.use("/api", healthRoutes);
  app.use("/api", systemRoutes);
  app.use("/api", firmwareRoutes);
  app.use("/api", esptoolRoutes);
}

module.exports = {
  registerRoutes,
  setShutdownHandler: systemRoutes.setShutdownHandler,
};
