/**
 * Utilities index.
 * Exports all utility modules.
 */

const logger = require("./logger");

module.exports = {
  logger,
  createLogger: logger.createLogger,
};
