/**
 * Terminal Output Module
 * Handles writing to the terminal with timestamps and buffer management.
 */

import * as store from "../state/store.js";
import { getTerminal } from "./setup.js";
import { parseSerialForPlotter } from "../plotter/parser.js";

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
    term.write(output);
    store.appendToLogBuffer(output);
  } else {
    term.write(data);
    store.appendToLogBuffer(data);
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
