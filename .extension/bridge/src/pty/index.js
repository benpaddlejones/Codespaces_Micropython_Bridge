/**
 * PTY Bridge Manager
 * Orchestrates socat process and SerialPort for PTY bridge functionality.
 *
 * RESILIENCE FEATURES:
 * - Auto-reconnect on serial port errors
 * - Graceful degradation if PTY unavailable
 * - Error isolation (never crashes the server)
 */

const fs = require("fs");
const { SerialPort } = require("serialport");
const config = require("../../config");
const socat = require("./socat");

let serialPort = null;
let remotePtyPath = null;
let isInitializing = false;
let dataHandlers = new Set();

// Self-healing state
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

/**
 * Initializes the PTY bridge by starting socat and opening the serial port.
 * Includes auto-recovery on failure.
 *
 * @returns {Promise<void>}
 */
async function initialize() {
  if (isInitializing) {
    console.log("[pty] Initialization already in progress");
    return;
  }

  isInitializing = true;

  try {
    remotePtyPath = await socat.start();
    const { linkPath, baudRate } = config.pty;

    console.log(`[pty] PTY bridge ready: ${linkPath} <-> ${remotePtyPath}`);

    // Open the remote PTY as a serial port
    serialPort = new SerialPort({
      path: remotePtyPath,
      baudRate: baudRate,
      autoOpen: true,
    });

    serialPort.on("error", (err) => {
      console.error("[pty] SerialPort error:", err.message);
      handleSerialError(err);
    });

    serialPort.on("close", () => {
      console.log("[pty] SerialPort closed");
      // Attempt reconnect if not shutting down
      if (remotePtyPath) {
        scheduleReconnect();
      }
    });

    serialPort.on("open", () => {
      console.log(`[pty] SerialPort opened on ${remotePtyPath}`);
      reconnectAttempts = 0; // Reset on successful connection
    });

    // Re-attach any existing data handlers
    for (const handler of dataHandlers) {
      serialPort.on("data", handler);
    }
  } catch (err) {
    console.error("[pty] Failed to initialize PTY bridge:", err.message);
    console.log(
      "[pty] Bridge will work without PTY forwarding (direct Web Serial only)"
    );
    throw err; // Let caller handle retry
  } finally {
    isInitializing = false;
  }
}

/**
 * Handle serial port errors with recovery
 */
function handleSerialError(err) {
  // Log but don't crash
  console.error("[pty] Serial error occurred:", err.message);

  // Schedule reconnection
  if (remotePtyPath && !isInitializing) {
    scheduleReconnect();
  }
}

/**
 * Schedule a reconnection attempt
 */
function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log("[pty] Max reconnect attempts reached, giving up");
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY * reconnectAttempts;

  console.log(
    `[pty] Scheduling reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`
  );

  setTimeout(async () => {
    try {
      // Clean up old connection
      if (serialPort) {
        try {
          serialPort.close();
        } catch (e) {
          // Ignore
        }
        serialPort = null;
      }

      // Try to reinitialize
      await initialize();
      console.log("[pty] Reconnection successful");
    } catch (err) {
      console.error("[pty] Reconnection failed:", err.message);
    }
  }, delay);
}

/**
 * Writes data to the PTY serial port.
 * Safe - never throws, silently fails if port unavailable.
 *
 * @param {Buffer|string} data - Data to write
 * @param {function} [callback] - Optional callback on completion
 */
function write(data, callback) {
  try {
    if (serialPort && serialPort.isOpen) {
      serialPort.write(data, (err) => {
        if (err) {
          console.error("[pty] Write error:", err.message);
        }
        if (callback) callback(err);
      });
    } else {
      // Silently ignore if port not ready
      if (callback) callback(null);
    }
  } catch (err) {
    console.error("[pty] Write exception:", err.message);
    if (callback) callback(err);
  }
}

/**
 * Registers a data handler for incoming PTY data.
 * Handlers persist across reconnections.
 *
 * @param {function} handler - Data handler function
 * @returns {function} Cleanup function to remove the handler
 */
function onData(handler) {
  // Store handler for re-attachment on reconnect
  dataHandlers.add(handler);

  if (serialPort) {
    try {
      serialPort.on("data", handler);
    } catch (err) {
      console.error("[pty] Failed to attach data handler:", err.message);
    }
  }

  return () => {
    dataHandlers.delete(handler);
    if (serialPort) {
      try {
        serialPort.off("data", handler);
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  };
}

/**
 * Shuts down the PTY bridge.
 * Safe - handles errors gracefully.
 */
function shutdown() {
  console.log("[pty] Shutting down...");

  // Clear data handlers
  dataHandlers.clear();

  if (serialPort) {
    try {
      if (serialPort.isOpen) {
        serialPort.close();
      }
    } catch (err) {
      console.error("[pty] Error closing serial port:", err.message);
    }
    serialPort = null;
  }

  try {
    socat.stop();
  } catch (err) {
    console.error("[pty] Error stopping socat:", err.message);
  }

  remotePtyPath = null;
  reconnectAttempts = 0;
}

/**
 * Returns the status of the PTY bridge.
 */
function getStatus() {
  const { linkPath } = config.pty;
  let linkExists = false;

  try {
    linkExists = fs.existsSync(linkPath);
  } catch (err) {
    // Ignore fs errors
  }

  return {
    ptyReady: !!serialPort && serialPort.isOpen,
    linkPath: linkPath,
    linkExists: linkExists,
    remotePtyPath: remotePtyPath,
    reconnectAttempts: reconnectAttempts,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    dataHandlersCount: dataHandlers.size,
  };
}

/**
 * Checks if the PTY is ready for use.
 */
function isReady() {
  return !!serialPort && serialPort.isOpen;
}

/**
 * Gets the serial port instance (for advanced use cases).
 */
function getSerialPort() {
  return serialPort;
}

module.exports = {
  initialize,
  write,
  onData,
  shutdown,
  getStatus,
  isReady,
  getSerialPort,
};
