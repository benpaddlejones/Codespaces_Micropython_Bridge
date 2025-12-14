/**
 * Project Utilities
 *
 * Functions for managing MicroPython project detection and active project selection.
 * Ensures only one .micropico marker exists at a time for consistent behavior.
 * Inactive projects use .micropico.inactive to track them for switching.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const PROJECT_MARKER = ".micropico";
const INACTIVE_MARKER = ".micropico.inactive";
const EXCLUDE_DIRS = new Set([
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

/**
 * Find all MicroPython project folders (active and inactive).
 *
 * Searches for folders containing either .micropico (active) or
 * .micropico.inactive (inactive) markers.
 *
 * @param workspaceRoot - The root path to start searching from
 * @param maxDepth - Maximum depth to search (default: 4)
 * @returns Array of objects with path and active status
 */
export function findAllProjects(
  workspaceRoot: string,
  maxDepth: number = 4
): Array<{ path: string; isActive: boolean }> {
  const results: Array<{ path: string; isActive: boolean }> = [];
  const queue: Array<{ dir: string; depth: number }> = [
    { dir: workspaceRoot, depth: 0 },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const { dir, depth } = current;
    if (!dir || visited.has(dir)) {
      continue;
    }
    visited.add(dir);

    // Check if this folder has active or inactive marker
    const activeMarkerPath = path.join(dir, PROJECT_MARKER);
    const inactiveMarkerPath = path.join(dir, INACTIVE_MARKER);

    if (fs.existsSync(activeMarkerPath)) {
      results.push({ path: dir, isActive: true });
    } else if (fs.existsSync(inactiveMarkerPath)) {
      results.push({ path: dir, isActive: false });
    }

    if (depth >= maxDepth) {
      continue;
    }

    // Scan subdirectories
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        if (entry.name.startsWith(".")) {
          continue;
        }
        if (EXCLUDE_DIRS.has(entry.name)) {
          continue;
        }

        queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
      }
    } catch {
      // Ignore errors reading directories
    }
  }

  return results;
}

/**
 * Find all folders containing .micropico markers (active projects only).
 *
 * Uses breadth-first search to find ALL folders with .micropico markers,
 * not just the first one. Respects excluded directories.
 *
 * @param workspaceRoot - The root path to start searching from
 * @param maxDepth - Maximum depth to search (default: 4)
 * @returns Array of absolute paths to folders with .micropico
 */
export function findAllProjectMarkers(
  workspaceRoot: string,
  maxDepth: number = 4
): string[] {
  return findAllProjects(workspaceRoot, maxDepth)
    .filter((p) => p.isActive)
    .map((p) => p.path);
}

/**
 * Set a folder as the active project.
 *
 * Renames .micropico to .micropico.inactive in other projects,
 * and ensures .micropico exists in the target project.
 * This ensures only one project is active at a time.
 *
 * @param projectPath - Path to make active
 * @param allProjects - List of all project folders (from findAllProjects)
 */
export async function setActiveProject(
  projectPath: string,
  allProjects: Array<{ path: string; isActive: boolean }> | string[]
): Promise<void> {
  // Normalize input to handle both old string[] and new format
  const projects: Array<{ path: string }> =
    Array.isArray(allProjects) &&
    allProjects.length > 0 &&
    typeof allProjects[0] === "string"
      ? (allProjects as string[]).map((p) => ({ path: p }))
      : (allProjects as Array<{ path: string }>);

  // 1. Deactivate all other projects (rename .micropico to .micropico.inactive)
  for (const project of projects) {
    if (project.path !== projectPath) {
      const activeMarker = path.join(project.path, PROJECT_MARKER);
      const inactiveMarker = path.join(project.path, INACTIVE_MARKER);
      try {
        if (fs.existsSync(activeMarker)) {
          fs.renameSync(activeMarker, inactiveMarker);
        }
      } catch (error) {
        console.error(`Failed to deactivate project ${project.path}:`, error);
      }
    }
  }

  // 2. Activate target project (ensure .micropico exists, remove .micropico.inactive)
  const targetActiveMarker = path.join(projectPath, PROJECT_MARKER);
  const targetInactiveMarker = path.join(projectPath, INACTIVE_MARKER);

  try {
    // Remove inactive marker if present
    if (fs.existsSync(targetInactiveMarker)) {
      fs.unlinkSync(targetInactiveMarker);
    }
    // Create active marker if not present
    if (!fs.existsSync(targetActiveMarker)) {
      fs.writeFileSync(
        targetActiveMarker,
        "This folder contains a MicroPython project\n"
      );
    }
  } catch (error) {
    console.error(`Failed to activate project ${projectPath}:`, error);
  }

  // 3. Refresh PROJECT FILES view
  vscode.commands.executeCommand("picoBridge.refreshWorkspaceFiles");
}

/**
 * Show QuickPick to let user choose active project.
 *
 * Displays a list of all projects (active and inactive) and lets
 * the user select which one should be the active project.
 *
 * @param projects - List of projects from findAllProjects
 * @param workspaceRoot - Workspace root for relative path display
 * @returns Selected project path or undefined if cancelled
 */
export async function promptForActiveProject(
  projects: Array<{ path: string; isActive: boolean }>,
  workspaceRoot: string
): Promise<string | undefined> {
  const items = projects.map((project) => {
    const relativePath = path.relative(workspaceRoot, project.path);
    const displayName = relativePath === "" ? "(workspace root)" : relativePath;
    const activeLabel = project.isActive ? " $(check) ACTIVE" : "";
    return {
      label: `$(folder) ${displayName}${activeLabel}`,
      description: project.isActive ? "Currently active" : "Click to activate",
      projectPath: project.path,
      isActive: project.isActive,
    };
  });

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "Select which project should be active",
    title: "Switch Active MicroPython Project",
  });

  return selected?.projectPath;
}

/**
 * Check for multiple active .micropico files and prompt user to choose.
 *
 * Call this at the start of any project-dependent command to ensure
 * there is exactly one active project. If multiple active markers are found,
 * prompts the user to select one and deactivates the others.
 *
 * @param workspaceRoot - The workspace root path
 * @returns Active project path, or undefined if no project/user cancelled
 */
export async function ensureSingleActiveProject(
  workspaceRoot: string
): Promise<string | undefined> {
  const allProjects = findAllProjects(workspaceRoot);
  const activeProjects = allProjects.filter((p) => p.isActive);

  if (activeProjects.length === 0) {
    return undefined; // No active project
  }

  if (activeProjects.length === 1) {
    return activeProjects[0].path; // Single active project, all good
  }

  // Multiple active projects - prompt user
  vscode.window.showWarningMessage(
    `Multiple active MicroPython projects detected (${activeProjects.length}). Please select one.`
  );

  const selected = await promptForActiveProject(allProjects, workspaceRoot);
  if (selected) {
    await setActiveProject(selected, allProjects);
    return selected;
  }

  return undefined; // User cancelled
}

/**
 * Get the current active project path.
 *
 * Returns the first project found without prompting.
 * Use ensureSingleActiveProject() if you need to handle multiple projects.
 *
 * @param workspaceRoot - The workspace root path
 * @returns Active project path, or undefined if no project found
 */
export function getActiveProject(workspaceRoot: string): string | undefined {
  const projects = findAllProjectMarkers(workspaceRoot);
  return projects.length > 0 ? projects[0] : undefined;
}
