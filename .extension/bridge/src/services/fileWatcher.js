/**
 * File Watcher Service
 * Watches the project directory for file changes and emits events.
 *
 * RESILIENCE: Auto-restarts on errors, handles directory issues gracefully.
 */

const fs = require("fs");
const path = require("path");
const config = require("../../config");
const fileService = require("./fileService");

let fileWatcher = null;
let markerWatcher = null;
let markerDebounceTimeout = null;
let watchedRoot = null;
let fileChangeTimeout = null;
let restartAttempts = 0;
let onChangeCallback = null;

const MAX_RESTART_ATTEMPTS = 3;
const RESTART_DELAY = 5000;

/**
 * Starts watching the project directory for changes.
 * Safe - handles errors and restarts automatically.
 *
 * @param {function} onChange - Callback when files change: (filename, eventType) => void
 * @returns {boolean} True if watcher started successfully
 */
function start(onChange) {
  const resolvedProjectDir = fileService.findProjectRoot();
  const { debounceMs, extensions } = config.fileWatcher;

  // Store callback for restart
  onChangeCallback = onChange;

  // Always (re)attach the marker watcher so project switches via
  // `.micropico` <-> `.micropico.inactive` renames rebind us live.
  ensureMarkerWatcher();

  // Stop existing watcher if any
  if (fileWatcher) {
    stop({ keepMarkerWatcher: true });
  }

  // Check if directory exists
  try {
    if (!resolvedProjectDir || !fs.existsSync(resolvedProjectDir)) {
      console.log(
        `[fileWatcher] Project directory not found: ${
          resolvedProjectDir || "<unset>"
        }`,
      );
      console.log("[fileWatcher] Ensure your project has a .micropico marker");
      scheduleRestart();
      return false;
    }
  } catch (err) {
    console.error(
      "[fileWatcher] Error checking project directory:",
      err.message,
    );
    scheduleRestart();
    return false;
  }

  try {
    fileWatcher = fs.watch(
      resolvedProjectDir,
      { recursive: true },
      (eventType, filename) => {
        try {
          // Only care about configured extensions (default: .py files)
          if (!filename) return;

          const hasValidExtension = extensions.some((ext) =>
            filename.endsWith(ext),
          );
          if (!hasValidExtension) return;

          // Debounce: wait before notifying to batch rapid changes
          if (fileChangeTimeout) {
            clearTimeout(fileChangeTimeout);
          }

          fileChangeTimeout = setTimeout(() => {
            console.log(`[fileWatcher] File changed: ${filename}`);
            if (onChange) {
              try {
                onChange(filename, eventType);
              } catch (callbackErr) {
                console.error(
                  "[fileWatcher] Callback error:",
                  callbackErr.message,
                );
              }
            }
          }, debounceMs);
        } catch (handlerErr) {
          console.error(
            "[fileWatcher] Event handler error:",
            handlerErr.message,
          );
        }
      },
    );

    // Handle watcher errors
    fileWatcher.on("error", (err) => {
      console.error("[fileWatcher] Watcher error:", err.message);
      scheduleRestart();
    });

    // Handle watcher close
    fileWatcher.on("close", () => {
      console.log("[fileWatcher] Watcher closed");
    });

    console.log("[fileWatcher] Started watching project directory");
    watchedRoot = resolvedProjectDir;
    restartAttempts = 0; // Reset on success
    return true;
  } catch (err) {
    console.error("[fileWatcher] Failed to start:", err.message);
    scheduleRestart();
    return false;
  }
}

/**
 * Schedule a restart attempt
 */
function scheduleRestart() {
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.log("[fileWatcher] Max restart attempts reached, giving up");
    return;
  }

  restartAttempts++;
  console.log(
    `[fileWatcher] Scheduling restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS} in ${RESTART_DELAY}ms`,
  );

  setTimeout(() => {
    if (onChangeCallback) {
      start(onChangeCallback);
    }
  }, RESTART_DELAY);
}

/**
 * Stops the file watcher.
 * Safe - handles errors gracefully.
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.keepMarkerWatcher=false] - Leave the .micropico
 *   marker watcher running so project switches still trigger rebinds.
 */
function stop(opts = {}) {
  const { keepMarkerWatcher = false } = opts;

  if (fileChangeTimeout) {
    try {
      clearTimeout(fileChangeTimeout);
    } catch (e) {
      // Ignore
    }
    fileChangeTimeout = null;
  }

  if (fileWatcher) {
    try {
      fileWatcher.close();
    } catch (err) {
      console.error("[fileWatcher] Error closing watcher:", err.message);
    }
    fileWatcher = null;
    watchedRoot = null;
    console.log("[fileWatcher] Stopped");
  }

  if (!keepMarkerWatcher) {
    stopMarkerWatcher();
  }

  // Don't clear onChangeCallback - may be needed for restart
}

/**
 * Watch the workspace recursively for `.micropico` / `.micropico.inactive`
 * marker changes. When a marker is created, deleted, or renamed (e.g. the
 * user switches the active project from the Bridge Tools view), re-resolve
 * the project root and restart the file watcher so it tracks the new
 * active project folder.
 */
function ensureMarkerWatcher() {
  if (markerWatcher) return;

  const { workspaceRoot } = config.paths;
  if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return;

  try {
    markerWatcher = fs.watch(
      workspaceRoot,
      { recursive: true },
      (_eventType, filename) => {
        if (!filename) return;
        const base = path.basename(filename);
        if (base !== ".micropico" && base !== ".micropico.inactive") {
          return;
        }

        // Debounce - rename pairs fire several events in quick succession.
        if (markerDebounceTimeout) clearTimeout(markerDebounceTimeout);
        markerDebounceTimeout = setTimeout(() => {
          const newRoot = fileService.findProjectRoot();
          if (newRoot === watchedRoot) return;
          console.log(
            `[fileWatcher] Project marker changed -> rebinding to ${
              newRoot || "<none>"
            }`,
          );
          if (onChangeCallback) {
            start(onChangeCallback);
            // Nudge the browser to refresh its file panel against the new root.
            try {
              onChangeCallback(".micropico", "project-switch");
            } catch (cbErr) {
              console.error(
                "[fileWatcher] project-switch callback error:",
                cbErr.message,
              );
            }
          }
        }, 250);
      },
    );

    markerWatcher.on("error", (err) => {
      console.error("[fileWatcher] Marker watcher error:", err.message);
      stopMarkerWatcher();
    });
  } catch (err) {
    console.error("[fileWatcher] Failed to start marker watcher:", err.message);
    markerWatcher = null;
  }
}

function stopMarkerWatcher() {
  if (markerDebounceTimeout) {
    try {
      clearTimeout(markerDebounceTimeout);
    } catch (e) {
      /* ignore */
    }
    markerDebounceTimeout = null;
  }
  if (markerWatcher) {
    try {
      markerWatcher.close();
    } catch (err) {
      console.error("[fileWatcher] Error closing marker watcher:", err.message);
    }
    markerWatcher = null;
  }
}

/**
 * Checks if the file watcher is running.
 *
 * @returns {boolean}
 */
function isRunning() {
  return fileWatcher !== null;
}

/**
 * Get watcher status
 */
function getStatus() {
  return {
    running: isRunning(),
    restartAttempts,
    maxRestartAttempts: MAX_RESTART_ATTEMPTS,
  };
}

module.exports = {
  start,
  stop,
  isRunning,
  getStatus,
};
