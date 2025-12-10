/**
 * File Service
 * Handles all file system operations for the project directory.
 */

const fs = require("fs");
const path = require("path");
const config = require("../../config");

/**
 * Finds the project root by looking for .micropico marker file.
 * Falls back to the configured project directory.
 *
 * @returns {string} Path to project root
 */
function findProjectRoot() {
  const { projectDir } = config.paths;

  // Check for .micropico marker file
  if (fs.existsSync(path.join(projectDir, ".micropico"))) {
    return projectDir;
  }

  // Fallback to configured project directory
  return projectDir;
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

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files/folders
      if (entry.name.startsWith(".")) continue;

      // Skip excluded folders
      if (excludeFolders.includes(entry.name)) continue;

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
 * Lists all Python files in the project directory.
 *
 * @returns {Array} Array of file objects with name, path, fullPath
 */
function listPythonFiles() {
  const projectRoot = findProjectRoot();
  const { files } = scanDirectory(projectRoot);
  return files;
}

/**
 * Gets the content of a specific file.
 *
 * @param {string} relativePath - Relative path to file from project root
 * @returns {Object|null} File content info or null if not found
 */
function getFileContent(relativePath) {
  const projectRoot = findProjectRoot();
  const filePath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf8");

  return {
    content,
    filename: path.basename(relativePath),
    destPath: "/" + relativePath, // Full path including folders for Pico
  };
}

/**
 * Gets all files in the lib folder.
 *
 * @returns {Array|null} Array of file objects with name and content, or null if lib doesn't exist
 */
function getLibFiles() {
  const libPath = path.join(config.paths.projectDir, "lib");

  if (!fs.existsSync(libPath)) {
    return null;
  }

  const files = [];
  const entries = fs.readdirSync(libPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".py")) {
      const content = fs.readFileSync(path.join(libPath, entry.name), "utf8");
      files.push({ name: entry.name, content });
    }
  }

  return files;
}

/**
 * Gets all project files with content (for full project sync).
 * Excludes the examples folder.
 *
 * @returns {Object} { files: [], directories: [] }
 */
function getProjectFiles() {
  const projectRoot = findProjectRoot();
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
  const projectRoot = findProjectRoot();
  return fs.existsSync(path.join(projectRoot, relativePath));
}

module.exports = {
  findProjectRoot,
  scanDirectory,
  listPythonFiles,
  getFileContent,
  getLibFiles,
  getProjectFiles,
  fileExists,
};
