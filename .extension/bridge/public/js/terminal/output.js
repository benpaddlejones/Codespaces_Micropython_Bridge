/**
 * Terminal Output Module
 * Handles writing to the terminal with timestamps and buffer management.
 */

import { parseSerialForPlotter } from "../plotter/parser.js";
import * as store from "../state/store.js";
import {
  bufferIfPaused,
  notifyTerminalUpdated,
  registerPauseFlush,
} from "./controls.js";
import { getTerminal, isAtBottom, scrollToBottom } from "./setup.js";

// --- Write coalescing -----------------------------------------------------
// Bursty serial output (REPL banner + os.listdir + tracebacks) used to
// trigger one term.write() per socket chunk, causing many small repaints
// and occasional "stuck near the bottom" rendering. We buffer chunks and
// flush once per animation frame, preserving the user's scroll position
// when they're reading history and snapping to the bottom otherwise.
let writeBuffer = "";
let flushScheduled = false;

function flushWriteBuffer() {
  flushScheduled = false;
  if (!writeBuffer) return;
  const term = getTerminal();
  if (!term) {
    writeBuffer = "";
    return;
  }
  const wasAtBottom = isAtBottom();
  const chunk = writeBuffer;
  writeBuffer = "";
  term.write(chunk, () => {
    if (wasAtBottom) scrollToBottom();
    notifyTerminalUpdated();
  });
}

function queueWrite(data) {
  writeBuffer += data;
  if (flushScheduled) return;
  flushScheduled = true;
  requestAnimationFrame(flushWriteBuffer);
}

// Allow the pause controls to flush their backlog through the same
// coalesced path on resume.
registerPauseFlush(queueWrite);

/**
 * Write to terminal with optional timestamp
 * @param {string} data - Data to write
 */
export function termWrite(data) {
  const term = getTerminal();
  if (!term) return;

  // Feed data to plotter if enabled
  if (store.isPlotterEnabled()) {
    parseSerialForPlotter(data);
  }

  const showTimestamp = store.isShowTimestamp();

  if (showTimestamp) {
    // Add timestamp at the beginning of each new line
    const timestamp = new Date().toLocaleTimeString();
    const lines = data.split("\n");
    let output = "";
    let lastCharWasNewline = store.getLastCharWasNewline();

    for (let i = 0; i < lines.length; i++) {
      if (lastCharWasNewline && lines[i].length > 0) {
        output += `[${timestamp}] `;
      }
      output += lines[i];
      if (i < lines.length - 1) {
        output += "\n";
        lastCharWasNewline = true;
      } else {
        lastCharWasNewline = lines[i].endsWith("\n") || lines[i].length === 0;
      }
    }

    store.setLastCharWasNewline(lastCharWasNewline);
    // Always log to the downloadable buffer, even when paused, so nothing
    // is lost from the user's perspective. Only the visible xterm write is
    // gated by the pause toggle.
    store.appendToLogBuffer(output);
    if (bufferIfPaused(output)) return;
    queueWrite(output);
  } else {
    store.appendToLogBuffer(data);
    if (bufferIfPaused(data)) return;
    queueWrite(data);
  }
}

/**
 * Set status display
 * @param {string} msg - Status message
 * @param {string} type - Status type: 'connected', 'disconnected', 'error'
 */
export function setStatus(msg, type = "disconnected") {
  const statusSpan = document.getElementById("status");
  if (!statusSpan) return;

  statusSpan.textContent = msg;
  statusSpan.className = "status-indicator";

  if (type === "connected") {
    statusSpan.classList.add("status-connected");
  } else if (type === "error") {
    statusSpan.classList.add("status-error");
  } else {
    statusSpan.classList.add("status-disconnected");
  }
}

/**
 * Download log buffer as text file
 */
export function downloadLog() {
  const logBuffer = store.getLogBuffer();
  const blob = new Blob([logBuffer], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pico-serial-log-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Clear terminal and log buffer
 */
export function clearOutput() {
  const term = getTerminal();
  if (term) {
    term.clear();
  }
  store.clearLogBuffer();
}
