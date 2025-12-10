/**
 * Status UI Module
 * Handles UI status updates for connection state.
 */

import * as store from "../state/store.js";
import { getById } from "./dom.js";

// Tool buttons configuration
const TOOL_BUTTONS = [
  { id: "listFilesBtn", label: "📁 List" },
  { id: "runFileBtn", label: "▶️ Run" },
  { id: "uploadFileBtn", label: "📄 File" },
  { id: "uploadLibBtn", label: "📚 Lib" },
  { id: "uploadProjectBtn", label: "📦 All" },
  { id: "stopBtn", label: "🛑 Stop" },
  { id: "softResetBtn", label: "🔄 Soft" },
  { id: "hardResetBtn", label: "⚡ Hard" },
  { id: "bootloaderBtn", label: "💾 Boot" },
  { id: "deleteAllBtn", label: "🗑️ Wipe" },
];

/**
 * Update tool buttons based on connection state
 * @param {boolean} connected - Whether Pico is connected
 */
export function updateToolButtons(connected) {
  TOOL_BUTTONS.forEach(({ id }) => {
    const btn = getById(id);
    if (!btn) return;

    // Skip runFileBtn and uploadFileBtn - they have special handling
    if (id === "runFileBtn" || id === "uploadFileBtn") return;

    btn.disabled = !connected;

    // Update tooltip to show stop sign when disconnected
    const originalTitle = btn.getAttribute("data-title") || btn.title;
    if (!btn.getAttribute("data-title")) {
      btn.setAttribute("data-title", originalTitle);
    }
    btn.title = connected
      ? originalTitle
      : `🛑 ${originalTitle} (Connect Pico first)`;
  });

  // Also disable file picker when not connected
  const filePicker = getById("filePicker");
  if (filePicker) {
    filePicker.disabled = !connected;
  }

  // Update file-dependent buttons
  updateFileButtons();

  // Update connect/disconnect buttons
  const connectBtn = getById("connectBtn");
  const disconnectBtn = getById("disconnectBtn");
  const serialInput = getById("serialInput");
  const sendBtn = getById("sendBtn");

  if (connectBtn) connectBtn.disabled = connected;
  if (disconnectBtn) disconnectBtn.disabled = !connected;
  if (serialInput) serialInput.disabled = !connected;
  if (sendBtn) sendBtn.disabled = !connected;
}

/**
 * Update Run and Upload File buttons based on file selection
 */
export function updateFileButtons() {
  const filePicker = getById("filePicker");
  const hasFile = filePicker && filePicker.value;
  const connected = store.isConnected();

  ["runFileBtn", "uploadFileBtn"].forEach((id) => {
    const btn = getById(id);
    if (!btn) return;

    // Store original title if not already stored
    const originalTitle = btn.getAttribute("data-title") || btn.title;
    if (!btn.getAttribute("data-title")) {
      btn.setAttribute("data-title", originalTitle);
    }

    if (!connected) {
      btn.disabled = true;
      btn.title = `🛑 ${originalTitle} (Connect Pico first)`;
      btn.classList.add("btn-no-file");
    } else if (!hasFile) {
      btn.disabled = true;
      btn.title = `🛑 ${originalTitle} (Select a file first)`;
      btn.classList.add("btn-no-file");
    } else {
      btn.disabled = false;
      btn.title = originalTitle;
      btn.classList.remove("btn-no-file");
    }
  });
}

/**
 * Initialize status UI on page load
 */
export function initStatusUI() {
  // Initialize tool buttons as disabled
  updateToolButtons(false);

  // Add file picker change listener
  const filePicker = getById("filePicker");
  if (filePicker) {
    filePicker.addEventListener("change", updateFileButtons);
  }
}
