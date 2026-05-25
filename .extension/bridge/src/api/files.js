/**
 * File-related API routes.
 * Handles listing, reading, and serving Python files from the project directory.
 */

const express = require("express");
const fileService = require("../services/fileService");
const syncService = require("../services/syncService");

const router = express.Router();

/**
 * GET /api/files
 * List all Python files in project directory
 */
router.get("/files", (req, res) => {
  try {
    const result = fileService.listPythonFiles();
    const files = Array.isArray(result) ? result : result.files;
    const projectDetected = Array.isArray(result)
      ? fileService.isProjectDetected()
      : result.projectDetected;
    const projectRoot = result.projectRoot || null;

    res.json({ success: true, files, projectDetected, projectRoot });
  } catch (err) {
    console.error("[api/files] Error listing files:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/file-content
 * Get content of a specific file
 * Query params: file - relative path to file
 */
router.get("/file-content", (req, res) => {
  const { file } = req.query;

  if (!file) {
    return res.status(400).json({ success: false, error: "No file specified" });
  }

  try {
    const result = fileService.getFileContent(file);
    if (!result) {
      return res.status(404).json({ success: false, error: "File not found" });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[api/files] Error reading file:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/lib-files
 * Get all files in the lib folder (for bulk upload to Pico)
 */
router.get("/lib-files", (req, res) => {
  try {
    const result = fileService.getLibFiles();
    if (!result) {
      return res
        .status(404)
        .json({ success: false, error: "lib folder not found" });
    }
    res.json({ success: true, files: result });
  } catch (err) {
    console.error("[api/files] Error reading lib files:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/project-files
 * Get all project files with content (for full project sync)
 * Excludes examples folder
 */
router.get("/project-files", (req, res) => {
  try {
    const result = fileService.getProjectFiles();
    if (!result) {
      return res.status(400).json({
        success: false,
        error:
          "Project marker not found. Create a .micropico file in your project root.",
      });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[api/files] Error reading project files:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/workspace/sync-status
 * List every deployable project file with size + SHA-256 so the browser
 * can join it against `os.listdir()` on the Pico and classify each path
 * as in-sync / modified / not-deployed / orphan-on-device.
 */
router.get("/workspace/sync-status", (req, res) => {
  try {
    const data = syncService.listWorkspaceFilesWithHash();
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("[api/files] sync-status error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/workspace/file?path=/main.py
 * Read a workspace file as UTF-8 text. Used by the Diff modal so it can
 * fetch any deployable file, not just the .py-only `/api/file-content`.
 */
router.get("/workspace/file", (req, res) => {
  const { path: picoPath } = req.query;
  if (!picoPath) {
    return res
      .status(400)
      .json({ success: false, error: "Missing 'path' query parameter" });
  }
  try {
    const result = syncService.readWorkspaceFile(picoPath);
    if (!result) {
      return res.status(404).json({ success: false, error: "File not found" });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[api/files] workspace/file error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/workspace/file
 * Body: { path: '/main.py', content: '...' }
 * Write content to the workspace (used by "Pull from device"). Refuses
 * paths that escape the detected project root.
 */
router.post("/workspace/file", express.json({ limit: "4mb" }), (req, res) => {
  const { path: picoPath, content } = req.body || {};
  if (!picoPath || typeof content !== "string") {
    return res
      .status(400)
      .json({ success: false, error: "Body must include path + content" });
  }
  try {
    const result = syncService.writeWorkspaceFile(picoPath, content);
    if (!result) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Refused: invalid or out-of-root path",
        });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[api/files] workspace/file write error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
