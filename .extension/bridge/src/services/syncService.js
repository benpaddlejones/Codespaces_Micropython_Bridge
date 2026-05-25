/**
 * Sync Service
 *
 * Provides the workspace-side data needed by the in-browser Sync Status
 * panel: a recursive listing of project files with size + SHA-256 so the
 * UI can compare against what's currently on the device.
 *
 * The device-side listing (and the matching SHA-256 computation) lives
 * in the browser module `public/js/tools/syncStatus.js`, which runs the
 * hash via `uhashlib.sha256` over the raw REPL.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const config = require("../../config");
const fileService = require("./fileService");

const { workspaceRoot } = config.paths;

// We list any file extension users typically deploy to a Pico. Limiting
// to a known set keeps the diff focused (we never want to compare
// `node_modules` style noise even if a marker has slipped into a weird
// location).
const DEPLOYABLE_EXTENSIONS = new Set([
  ".py",
  ".mpy",
  ".json",
  ".txt",
  ".html",
  ".css",
  ".js",
  ".csv",
  ".cfg",
  ".ini",
  ".toml",
  ".md",
]);

// Reuse the file-watcher exclude list plus a few project-noise dirs.
const EXCLUDE_FOLDERS = new Set([
  ...(config.fileWatcher?.excludeFolders || []),
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  ".vscode",
  "__pycache__",
  ".venv",
  ".mypy_cache",
  ".pytest_cache",
  "release",
]);

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function walk(dir, baseDir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_err) {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (EXCLUDE_FOLDERS.has(entry.name)) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full, baseDir, out);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!DEPLOYABLE_EXTENSIONS.has(ext)) continue;

    let stat;
    try {
      stat = fs.statSync(full);
    } catch (_err) {
      continue;
    }

    // Skip absurdly large files — these aren't realistic to push to a
    // Pico anyway and hashing them would block the event loop.
    if (stat.size > 1024 * 1024) continue;

    let buf;
    try {
      buf = fs.readFileSync(full);
    } catch (_err) {
      continue;
    }

    // Pico paths are absolute and forward-slash; mirror that here so the
    // join with device listings on the client is a simple string match.
    const rel = path.relative(baseDir, full).split(path.sep).join("/");
    out.push({
      path: "/" + rel,
      size: stat.size,
      sha256: sha256Hex(buf),
    });
  }
}

/**
 * List every deployable file in the detected project (or the workspace
 * root, when no project marker is present) with size + SHA-256.
 *
 * @returns {{ projectDetected: boolean, projectRoot: string|null,
 *             files: Array<{path:string, size:number, sha256:string}> }}
 */
function listWorkspaceFilesWithHash() {
  const projectRoot =
    fileService.findProjectRoot?.({ allowFallback: true }) || workspaceRoot;
  const projectDetected = Boolean(
    fileService.findProjectRoot?.({ allowFallback: false }),
  );

  const files = [];
  walk(projectRoot, projectRoot, files);
  files.sort((a, b) => a.path.localeCompare(b.path));

  let projectRootRelative = null;
  if (projectRoot) {
    projectRootRelative =
      path.relative(workspaceRoot, projectRoot).split(path.sep).join("/") ||
      ".";
  }

  return {
    projectDetected,
    projectRoot: projectRootRelative,
    files,
  };
}

/**
 * Read raw file content from the workspace for a given Pico-style path.
 * Used by the "Diff" action so the browser can show side-by-side text
 * without having to re-fetch via the .py-only `/api/file-content` route.
 *
 * @param {string} picoPath - Path like "/main.py" relative to project root
 * @returns {{ content: string, size: number } | null}
 */
function readWorkspaceFile(picoPath) {
  if (!picoPath || typeof picoPath !== "string") return null;

  const projectRoot =
    fileService.findProjectRoot?.({ allowFallback: true }) || workspaceRoot;

  const safeRel = picoPath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (safeRel.includes("..")) return null;

  const absolute = path.resolve(projectRoot, safeRel);
  const rootResolved = path.resolve(projectRoot);
  if (!absolute.startsWith(rootResolved)) return null;

  if (!fs.existsSync(absolute)) return null;

  const stat = fs.statSync(absolute);
  if (!stat.isFile()) return null;

  return {
    content: fs.readFileSync(absolute, "utf8"),
    size: stat.size,
  };
}

/**
 * Write content to a workspace file (used by "Pull from device"). Will
 * create intermediate directories as needed. Refuses to write outside
 * the detected project root.
 *
 * @param {string} picoPath - Path like "/main.py"
 * @param {string} content
 * @returns {{ written: string } | null}
 */
function writeWorkspaceFile(picoPath, content) {
  if (!picoPath || typeof picoPath !== "string") return null;
  if (typeof content !== "string") return null;

  const projectRoot =
    fileService.findProjectRoot?.({ allowFallback: true }) || workspaceRoot;

  const safeRel = picoPath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (safeRel.includes("..")) return null;

  const absolute = path.resolve(projectRoot, safeRel);
  const rootResolved = path.resolve(projectRoot);
  if (!absolute.startsWith(rootResolved)) return null;

  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, "utf8");

  return {
    written: path.relative(workspaceRoot, absolute).split(path.sep).join("/"),
  };
}

module.exports = {
  listWorkspaceFilesWithHash,
  readWorkspaceFile,
  writeWorkspaceFile,
};
