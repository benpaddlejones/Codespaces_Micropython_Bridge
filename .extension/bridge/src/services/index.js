/**
 * Services index.
 * Exports all service modules.
 */

const fileService = require("./fileService");
const fileWatcher = require("./fileWatcher");

module.exports = {
  fileService,
  fileWatcher,
};
