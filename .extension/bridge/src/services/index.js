/**
 * Services index.
 * Exports all service modules.
 */

const fileService = require("./fileService");
const fileWatcher = require("./fileWatcher");
const syncService = require("./syncService");

module.exports = {
  fileService,
  fileWatcher,
  syncService,
};
