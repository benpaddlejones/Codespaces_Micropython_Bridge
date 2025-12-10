/**
 * File Service
 * Handles all file system operations for the project directory.
 */

const fs = require("fs");
const path = require("path");
const config = require("../../config");

const { projectDir, workspaceRoot } = config.paths;
const PROJECT_MARKER = ".micropico";
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
      } else if (entry.name.endsWith(".py")) {
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
      err.message
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
    new Set([...config.fileWatcher.excludeFolders, ...SEARCH_EXCLUDE_FOLDERS])
  );

  // Scan from workspace root so users can see all files
  const { files } = scanDirectory(workspaceRoot, "", { excludeFolders });

  // Calculate relative project root path for UI context
  let projectRootRelative = null;
  if (projectRoot) {
    projectRootRelative = path.relative(workspaceRoot, projectRoot);
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

  const workspacePath = path.resolve(workspaceRoot);
  const absolutePath = path.resolve(workspacePath, relativePath);

  if (!absolutePath.startsWith(workspacePath)) {
    return null;
  }

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const projectRoot = findProjectRoot();
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

  const base = path.resolve(workspaceRoot);
  const candidate = path.resolve(base, relativePath);

  if (!candidate.startsWith(base)) {
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
