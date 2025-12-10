/**
 * File Manager Module
 * Handles workspace file listing and selection.
 */

import * as store from "../state/store.js";
import { termWrite } from "../terminal/output.js";
import { updateFileButtons, updateToolButtons } from "../ui/status.js";

/**
 * Load workspace files into file picker dropdown
 */
export async function loadWorkspaceFiles() {
  try {
    const response = await fetch("/api/files");
    const data = await response.json();

    if (data.success) {
      const projectDetected = Boolean(data.projectDetected);
      store.setProjectDetected(projectDetected);
      store.setProjectRoot(data.projectRoot || null);
      updateFilePicker(Array.isArray(data.files) ? data.files : []);
      updateToolButtons(store.isConnected());
    }
  } catch (err) {
    console.error("Failed to load workspace files:", err);
  }
}

/**
 * Update file picker dropdown with files
 * @param {Array} files - Array of file objects
 */
function updateFilePicker(files) {
  const filePicker = document.getElementById("filePicker");
  if (!filePicker) return;

  // Save current selection to restore after refresh
  const previousSelection = filePicker.value;

  filePicker.innerHTML = '<option value="">Select a file...</option>';

  // Get project root for context
  const projectRoot = store.getProjectRoot();
  const projectDetected = store.isProjectDetected();

  // Group files by directory
  const groups = {};
  files.forEach((file) => {
    const parts = file.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "root";
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(file);
  });

  // Determine which directories are inside the project
  const isInProject = (dir) => {
    if (!projectDetected || !projectRoot) return false;
    if (projectRoot === "." || projectRoot === "") return true;
    return (
      dir === projectRoot ||
      dir.startsWith(projectRoot + "/") ||
      (dir === "root" && projectRoot === ".")
    );
  };

  // Sort directories so project root files surface first
  const getGroupPriority = (dir) => {
    if (projectDetected && projectRoot) {
      if (projectRoot === "." || projectRoot === "") {
        if (dir === "root") return 0;
        if (!dir.includes("/")) return 1;
        return 2;
      }

      if (dir === projectRoot) {
        return 0;
      }
      if (dir.startsWith(projectRoot + "/")) {
        return 1;
      }
      if (dir === "root") {
        return 2;
      }
      return 3;
    }

    return dir === "root" ? 0 : 1;
  };

  const sortedDirs = Object.keys(groups).sort((a, b) => {
    const priorityDiff = getGroupPriority(a) - getGroupPriority(b);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const aInProject = isInProject(a);
    const bInProject = isInProject(b);
    if (aInProject && !bInProject) return -1;
    if (!aInProject && bInProject) return 1;
    return a.localeCompare(b);
  });

  // Add options grouped by directory
  sortedDirs.forEach((dir) => {
    const optgroup = document.createElement("optgroup");
    const inProject = isInProject(dir);

    // Format label to show project context
    let label = dir === "root" ? "Workspace Root" : dir;
    if (projectDetected && inProject) {
      label = "📁 " + label;
    } else if (projectDetected) {
      label = "📂 " + label + " (outside project)";
    }

    optgroup.label = label;

    groups[dir].forEach((file) => {
      const opt = document.createElement("option");
      opt.value = file.path;
      opt.textContent = file.name;
      optgroup.appendChild(opt);
    });
    filePicker.appendChild(optgroup);
  });

  // Restore previous selection if it still exists
  if (previousSelection) {
    const optionExists = Array.from(filePicker.options).some(
      (opt) => opt.value === previousSelection
    );
    if (optionExists) {
      filePicker.value = previousSelection;
    }
  }

  // Update Run/Upload buttons after loading files
  updateFileButtons();
}

/**
 * Get content of a file from server
 * @param {string} filePath - Relative path to file
 * @returns {Object|null} File data object or null
 */
export async function getFileContent(filePath) {
  try {
    const response = await fetch(
      `/api/file-content?file=${encodeURIComponent(filePath)}`
    );
    const data = await response.json();

    if (!data.success) {
      termWrite(`[Error] ${data.error}\r\n`);
      return null;
    }

    return data;
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
    return null;
  }
}

/**
 * Get all lib files from server
 * @returns {Array|null} Array of lib files or null
 */
export async function getLibFiles() {
  try {
    const response = await fetch("/api/lib-files");
    const data = await response.json();

    if (!data.success) {
      termWrite(`[Error] ${data.error}\r\n`);
      return null;
    }

    return data.files;
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
    return null;
  }
}

/**
 * Get all project files from server
 * @returns {Object|null} Project files data or null
 */
export async function getProjectFiles() {
  try {
    const response = await fetch("/api/project-files");
    const data = await response.json();

    if (!data.success) {
      termWrite(`[Error] ${data.error}\r\n`);
      return null;
    }

    return {
      files: data.files,
      directories: data.directories || [],
    };
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
    return null;
  }
}

/**
 * Get currently selected file from file picker
 * @returns {string|null} Selected file path or null
 */
export function getSelectedFile() {
  const filePicker = document.getElementById("filePicker");
  return filePicker?.value || null;
}
