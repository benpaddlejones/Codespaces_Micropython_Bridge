/**
 * Socat process management for PTY bridge creation.
 * Creates a PTY pair using socat - one end for mpremote, one for SerialPort.
 *
 * RESILIENCE: Handles process crashes, cleanup errors, and restart scenarios.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const config = require("../../config");

let socatProcess = null;
let isStarting = false;

/**
 * Cleans up any existing symlink at the PTY link path.
 * Safe - never throws.
 */
function cleanup() {
  const { linkPath } = config.pty;
  try {
    if (fs.existsSync(linkPath)) {
      fs.unlinkSync(linkPath);
      console.log(`[socat] Removed existing link at ${linkPath}`);
    }
  } catch (err) {
    // Log but don't throw - cleanup failures shouldn't crash the server
    console.error("[socat] Error cleaning up link:", err.message);
  }
}

/**
 * Starts socat to create a PTY pair.
 * Returns a promise that resolves to the remote PTY path.
 * Safe - handles all error cases gracefully.
 *
 * @returns {Promise<string>} The path to the remote PTY (e.g., /dev/pts/X)
 */
function start() {
  const { linkPath, socatTimeout } = config.pty;
  const { command, getArgs } = config.socat;

  // Prevent multiple simultaneous starts
  if (isStarting) {
    return Promise.reject(new Error("Socat start already in progress"));
  }

  // Stop any existing process first
  if (socatProcess) {
    stop();
  }

  isStarting = true;

  return new Promise((resolve, reject) => {
    cleanup();

    let remotePtyPath = null;
    let resolved = false;
    const args = getArgs(linkPath);

    try {
      socatProcess = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      isStarting = false;
      reject(new Error(`Failed to spawn socat: ${err.message}`));
      return;
    }

    socatProcess.stderr.on("data", (chunk) => {
      try {
        const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          console.log(`[socat] ${line}`);

          // Parse socat output to find the second PTY path
          // socat outputs: "N PTY is /dev/pts/X"
          const match = line.match(/PTY is (\/dev\/pts\/\d+)/);
          if (match && !remotePtyPath) {
            // First PTY is linked to linkPath, second is for us
            try {
              if (fs.existsSync(linkPath)) {
                remotePtyPath = match[1];
                console.log(`[socat] Remote PTY path: ${remotePtyPath}`);
                if (!resolved) {
                  resolved = true;
                  isStarting = false;
                  resolve(remotePtyPath);
                }
              }
            } catch (fsErr) {
              // Ignore fs check errors
            }
          }
        }
      } catch (parseErr) {
        console.error("[socat] Error parsing stderr:", parseErr.message);
      }
    });

    socatProcess.on("error", (err) => {
      console.error("[socat] Process error:", err.message);
      if (!resolved) {
        resolved = true;
        isStarting = false;
        reject(err);
      }
    });

    socatProcess.on("exit", (code) => {
      console.log(`[socat] Exited with code ${code}`);
      remotePtyPath = null;
      socatProcess = null;
      cleanup();
    });

    // Timeout if socat doesn't start
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        isStarting = false;
        reject(new Error("Timeout waiting for socat to create PTYs"));
      }
    }, socatTimeout);
  });
}

/**
 * Stops the socat process and cleans up.
 * Safe - never throws, handles all error cases.
 */
function stop() {
  if (socatProcess) {
    console.log("[socat] Stopping process...");
    try {
      socatProcess.kill("SIGTERM");
    } catch (err) {
      console.error("[socat] Error killing process:", err.message);
      // Try SIGKILL as fallback
      try {
        socatProcess.kill("SIGKILL");
      } catch (e) {
        // Give up gracefully
      }
    }
    socatProcess = null;
  }
  cleanup();
  isStarting = false;
}

/**
 * Returns the current socat process (for status checks).
 */
function getProcess() {
  return socatProcess;
}

/**
 * Check if socat is running
 */
function isRunning() {
  return socatProcess !== null && !socatProcess.killed;
}

module.exports = {
  start,
  stop,
  cleanup,
  getProcess,
  isRunning,
};
