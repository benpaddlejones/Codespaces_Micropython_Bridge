/**
 * File Manager Module
 * Handles workspace file listing and selection.
 */

import { termWrite } from "../terminal/output.js";
import { updateFileButtons } from "../ui/status.js";

/**
 * Load workspace files into file picker dropdown
 */
export async function loadWorkspaceFiles() {
  try {
    const response = await fetch("/api/files");
    const data = await response.json();

    if (data.success) {
      updateFilePicker(data.files);
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

  // Group files by directory
  const groups = {};
  files.forEach((file) => {
    const parts = file.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "root";
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(file);
  });

  // Add options grouped by directory
  Object.keys(groups)
    .sort()
    .forEach((dir) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = dir === "root" ? "Project Root" : dir;
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
