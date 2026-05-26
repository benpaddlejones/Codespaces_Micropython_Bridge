/**
 * File Service
 * Handles all file system operations for the project directory.
 */

const fs = require("fs");
const path = require("path");
const config = require("../../config");

const { projectDir, workspaceRoot } = config.paths;
const PROJECT_MARKER = ".micropico";
// Extensions that count as "project files" for upload to the device.
// Keeps the .py-only behaviour of the legacy File picker but lets
// Upload Project / Upload Lib / file watch pick up data + config files.
const UPLOADABLE_EXTENSIONS = new Set([
  ".py",
  ".mpy",
  ".json",
  ".txt",
  ".csv",
  ".md",
  ".conf",
  ".cfg",
  ".ini",
  ".toml",
  ".html",
  ".css",
  ".js",
]);
const SEARCH_EXCLUDE_FOLDERS = new Set([
  "node_modules",
  "bower_components",
  ".git",
  ".hg",
  ".svn",
  ".vscode",
  "__pycache__",
  ".venv",
  ".mypy_cache",
]);

function hasMarker(dir) {
  if (!dir) return false;

  try {
    return fs.existsSync(path.join(dir, PROJECT_MARKER));
  } catch (err) {
    console.error("[fileService] Marker check failed:", err.message);
    return false;
  }
}

function findMarkerDirectory(startDir, options = {}) {
  const { maxDepth = 4 } = options;
  if (!startDir) return null;

  const queue = [{ dir: startDir, depth: 0 }];
  const visited = new Set();

  while (queue.length > 0) {
    const { dir, depth } = queue.shift();
    if (!dir || visited.has(dir)) continue;
    visited.add(dir);

    if (hasMarker(dir)) {
      return dir;
    }

    if (depth >= maxDepth) {
      continue;
    }

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;
      if (SEARCH_EXCLUDE_FOLDERS.has(entry.name)) continue;

      const childDir = path.join(dir, entry.name);
      queue.push({ dir: childDir, depth: depth + 1 });
    }
  }

  return null;
}

/**
 * Finds the project root by looking for project marker files.
 * Optionally falls back to a best-guess directory when markers are absent.
 *
 * @param {Object} [options]
 * @param {boolean} [options.allowFallback=false] - Allow returning a best guess when undetected
 * @returns {string|null} Path to project root or null when not found
 */
function findProjectRoot(options = {}) {
  const { allowFallback = false } = options;

  if (hasMarker(workspaceRoot)) {
    return workspaceRoot;
  }

  if (hasMarker(projectDir)) {
    return projectDir;
  }

  const discovered = findMarkerDirectory(workspaceRoot, { maxDepth: 4 });
  if (discovered) {
    return discovered;
  }

  if (allowFallback) {
    if (fs.existsSync(projectDir)) {
      return projectDir;
    }

    if (fs.existsSync(workspaceRoot)) {
      return workspaceRoot;
    }
  }

  return null;
}

function isProjectDetected() {
  return Boolean(findProjectRoot());
}

/**
 * Scans a directory recursively for Python files.
 *
 * @param {string} dir - Directory to scan
 * @param {string} [prefix=''] - Path prefix for relative paths
 * @param {Object} [options={}] - Scan options
 * @param {boolean} [options.includeContent=false] - Include file content
 * @param {string[]} [options.excludeFolders=[]] - Folders to exclude
 * @returns {Object} - { files: [], directories: Set }
 */
function scanDirectory(dir, prefix = "", options = {}) {
  const { includeContent = false, excludeFolders = [] } = options;
  const files = [];
  const directories = new Set();

  if (!dir) {
    return { files, directories };
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files/folders
      if (entry.name.startsWith(".")) continue;

      // Skip excluded folders
      if (excludeFolders.includes(entry.name)) continue;

      if (entry.isDirectory() && SEARCH_EXCLUDE_FOLDERS.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        directories.add("/" + relativePath);
        const subResult = scanDirectory(fullPath, relativePath, options);
        files.push(...subResult.files);
        subResult.directories.forEach((d) => directories.add(d));
      } else {
        // Pickers used to be .py-only. For upload paths (includeContent
        // = true) accept every deployable extension so configs, data
        // files, compiled modules etc all sync to the device.
        const ext = path.extname(entry.name).toLowerCase();
        const accepted = includeContent
          ? UPLOADABLE_EXTENSIONS.has(ext)
          : ext === ".py";
        if (!accepted) continue;

        const fileInfo = {
          name: entry.name,
          path: relativePath,
          fullPath: fullPath,
        };

        if (includeContent) {
          fileInfo.content = fs.readFileSync(fullPath, "utf8");
          fileInfo.path = "/" + relativePath; // Prefix with / for Pico paths
        }

        files.push(fileInfo);
      }
    }
  } catch (err) {
    console.error(
      `[fileService] Error scanning directory ${dir}:`,
      err.message,
    );
  }

  return { files, directories };
}

/**
 * Lists all Python files in the workspace, with project detection info.
 *
 * @returns {{ files: Array, projectDetected: boolean, projectRoot: string|null }}
 */
function listPythonFiles() {
  const projectRoot = findProjectRoot();
  const projectDetected = Boolean(projectRoot);
  const excludeFolders = Array.from(
    new Set([...config.fileWatcher.excludeFolders, ...SEARCH_EXCLUDE_FOLDERS]),
  );

  // Scope the listing to the active project when one is detected so the
  // file picker only shows files that belong to the current MicroPython
  // project. Fall back to the workspace root only when no marker exists.
  const scanRoot = projectRoot || workspaceRoot;
  const { files } = scanDirectory(scanRoot, "", { excludeFolders });

  // Calculate relative project root path for UI context. When we scanned
  // from the project root, paths returned are already project-relative,
  // so the UI's "project root" becomes ".".
  let projectRootRelative = null;
  if (projectRoot) {
    projectRootRelative =
      projectRoot === scanRoot
        ? "."
        : path.relative(workspaceRoot, projectRoot);
    if (projectRootRelative === "") {
      projectRootRelative = ".";
    }
  }

  return {
    files,
    projectDetected,
    projectRoot: projectRootRelative,
  };
}

/**
 * Gets the content of a specific file.
 *
 * @param {string} relativePath - Relative path to file from project root
 * @returns {Object|null} File content info or null if not found
 */
function getFileContent(relativePath) {
  if (!relativePath) {
    return null;
  }

  const projectRoot = findProjectRoot();
  // When a project marker exists, resolve relative paths against the
  // project root (matches what listPythonFiles returns). Otherwise fall
  // back to the workspace root.
  const baseRoot = path.resolve(projectRoot || workspaceRoot);
  const workspacePath = path.resolve(workspaceRoot);
  let absolutePath = path.resolve(baseRoot, relativePath);

  // Backwards-compat: if the path doesn't exist under the project root
  // but does exist under the workspace root, try that as a fallback.
  if (
    baseRoot !== workspacePath &&
    !fs.existsSync(absolutePath) &&
    fs.existsSync(path.resolve(workspacePath, relativePath))
  ) {
    absolutePath = path.resolve(workspacePath, relativePath);
  }

  if (
    absolutePath !== workspacePath &&
    !absolutePath.startsWith(workspacePath + path.sep)
  ) {
    return null;
  }

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const projectDetected = Boolean(projectRoot);
  let destPath = null;

  if (projectDetected && projectRoot) {
    const relativeToProject = path.relative(projectRoot, absolutePath);
    if (
      relativeToProject &&
      !relativeToProject.startsWith("..") &&
      !path.isAbsolute(relativeToProject)
    ) {
      destPath = "/" + relativeToProject.replace(/\\/g, "/");
    }
  }

  return {
    content,
    filename: path.basename(relativePath),
    destPath,
    projectDetected,
  };
}

/**
 * Gets all files in the lib folder (recursive).
 *
 * @returns {Array|null} Array of file objects with path and content, or null if lib doesn't exist
 */
function getLibFiles() {
  const projectRoot = findProjectRoot();
  if (!projectRoot) return null;

  const libPath = path.join(projectRoot, "lib");

  if (!fs.existsSync(libPath)) {
    return null;
  }

  // Use scanDirectory for recursive scanning
  const { files } = scanDirectory(libPath, "lib", {
    includeContent: true,
    excludeFolders: [],
  });

  return files;
}

/**
 * Gets all project files with content (for full project sync).
 * Excludes the examples folder.
 *
 * @returns {Object|null} { files: [], directories: [] } or null when project not detected
 */
function getProjectFiles() {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    return null;
  }
  const { excludeFolders } = config.fileWatcher;

  const { files, directories } = scanDirectory(projectRoot, "", {
    includeContent: true,
    excludeFolders,
  });

  return {
    files,
    directories: Array.from(directories).sort(),
  };
}

/**
 * Checks if a file exists in the project directory.
 *
 * @param {string} relativePath - Relative path to file
 * @returns {boolean}
 */
function fileExists(relativePath) {
  if (!relativePath) return false;

  const projectRoot = findProjectRoot();
  const base = path.resolve(projectRoot || workspaceRoot);
  const workspacePath = path.resolve(workspaceRoot);
  let candidate = path.resolve(base, relativePath);

  if (
    base !== workspacePath &&
    !fs.existsSync(candidate) &&
    fs.existsSync(path.resolve(workspacePath, relativePath))
  ) {
    candidate = path.resolve(workspacePath, relativePath);
  }

  if (
    candidate !== workspacePath &&
    !candidate.startsWith(workspacePath + path.sep)
  ) {
    return false;
  }

  return fs.existsSync(candidate);
}

module.exports = {
  findProjectRoot,
  scanDirectory,
  listPythonFiles,
  getFileContent,
  getLibFiles,
  getProjectFiles,
  fileExists,
  isProjectDetected,
};
