/**
 * File Watcher Service
 * Watches the project directory for file changes and emits events.
 *
 * RESILIENCE: Auto-restarts on errors, handles directory issues gracefully.
 */

const fs = require("fs");
const config = require("../../config");
const fileService = require("./fileService");

let fileWatcher = null;
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

  // Stop existing watcher if any
  if (fileWatcher) {
    stop();
  }

  // Check if directory exists
  try {
    if (!resolvedProjectDir || !fs.existsSync(resolvedProjectDir)) {
      console.log(
        `[fileWatcher] Project directory not found: ${
          resolvedProjectDir || "<unset>"
        }`
      );
      console.log("[fileWatcher] Ensure your project has a .micropico marker");
      scheduleRestart();
      return false;
    }
  } catch (err) {
    console.error(
      "[fileWatcher] Error checking project directory:",
      err.message
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
            filename.endsWith(ext)
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
                  callbackErr.message
                );
              }
            }
          }, debounceMs);
        } catch (handlerErr) {
          console.error(
            "[fileWatcher] Event handler error:",
            handlerErr.message
          );
        }
      }
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
    `[fileWatcher] Scheduling restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS} in ${RESTART_DELAY}ms`
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
 */
function stop() {
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
    console.log("[fileWatcher] Stopped");
  }

  // Don't clear onChangeCallback - may be needed for restart
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
