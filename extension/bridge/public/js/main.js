/**
 * Pico Bridge Client - Main Entry Point
 *
 * A modular client for the Pi Pico Bridge, providing:
 * - Web Serial connection to Raspberry Pi Pico
 * - xterm.js terminal interface
 * - File management and upload tools
 * - Real-time data plotter
 * - Socket.io bridge to Codespaces server
 *
 * Architecture:
 * - js/state/     - Centralized state management
 * - js/serial/    - Web Serial API handling
 * - js/terminal/  - xterm.js setup and output
 * - js/tools/     - Pico file operations
 * - js/plotter/   - Data visualization
 * - js/socket/    - Server communication
 * - js/ui/        - UI utilities and status
 */

// === Module Imports ===
import * as store from "./state/store.js";
import {
  connect,
  disconnect,
  sendData,
  changeBaudRate,
  sleep,
} from "./serial/index.js";
import {
  initTerminal,
  getTerminal,
  writeWelcomeMessage,
  fitTerminal,
  clearTerminal,
} from "./terminal/index.js";
import {
  termWrite,
  setStatus,
  downloadLog,
  clearOutput,
} from "./terminal/output.js";
import { setupKeyboardHandlers } from "./terminal/handlers.js";
import { loadWorkspaceFiles, getSelectedFile } from "./tools/fileManager.js";
import {
  listPicoFiles,
  runFile,
  uploadFile,
  uploadLib,
  uploadProject,
  deleteAllFiles,
} from "./tools/picoSync.js";
import {
  stopCode,
  softReset,
  hardReset,
  enterBootloader,
} from "./tools/picoControl.js";
import { downloadFirmware, getFirmwareInfo } from "./tools/firmware.js";
import { setupPlotterEventListeners } from "./plotter/controls.js";
import { initSocket, setupRestartButton } from "./socket/index.js";
import {
  initStatusUI,
  updateToolButtons,
  updateFileButtons,
} from "./ui/status.js";
import { getById, addListener, getValue, setValue } from "./ui/dom.js";

// === Initialization ===

/**
 * Initialize the application
 */
function init() {
  // Initialize terminal
  const terminalContainer = getById("terminal-container");
  if (terminalContainer) {
    initTerminal(terminalContainer);
    setupKeyboardHandlers();
    writeWelcomeMessage();
  }

  // Initialize Socket.io
  initSocket();
  setupRestartButton();

  // Initialize UI
  initStatusUI();
  setupDeviceInfoSubscription();

  // Setup event listeners
  setupConnectionListeners();
  setupInputListeners();
  setupToolListeners();
  setupPlotterEventListeners();

  // Load workspace files
  loadWorkspaceFiles();
}

// === Event Listener Setup ===

/**
 * Setup connection button listeners
 */
function setupConnectionListeners() {
  addListener("connectBtn", "click", async () => {
    const baudRate = parseInt(getValue("baudRate") || "115200");
    await connect(baudRate);
  });

  addListener("disconnectBtn", "click", async () => {
    await disconnect();
  });

  addListener("baudRate", "change", async () => {
    if (store.isConnected()) {
      const newBaud = parseInt(getValue("baudRate"));
      await changeBaudRate(newBaud);
    }
  });
}

/**
 * Setup input field listeners
 */
function setupInputListeners() {
  const sendBtn = getById("sendBtn");
  const serialInput = getById("serialInput");
  const lineEndingSelect = getById("lineEnding");

  const sendInputData = async () => {
    const data = getValue("serialInput");
    const endings = { none: "", nl: "\n", cr: "\r", nlcr: "\r\n" };
    const ending = endings[getValue("lineEnding")] || "";

    if ((data || ending) && store.isConnected()) {
      await sendData(data + ending);
      setValue("serialInput", "");
    }
  };

  if (sendBtn) {
    sendBtn.addEventListener("click", sendInputData);
  }

  if (serialInput) {
    serialInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        sendInputData();
      }
    });
  }

  // Timestamp toggle
  addListener("timestampCheck", "change", (e) => {
    store.setShowTimestamp(e.target.checked);
  });

  // Clear button
  addListener("clearBtn", "click", () => {
    clearOutput();
  });

  // Download button
  addListener("downloadBtn", "click", () => {
    downloadLog();
  });
}

/**
 * Setup tool button listeners
 */
function setupToolListeners() {
  // File listing
  addListener("listFilesBtn", "click", listPicoFiles);

  // Run file
  addListener("runFileBtn", "click", () => {
    const selectedFile = getSelectedFile();
    if (selectedFile) {
      runFile(selectedFile);
    } else {
      termWrite("\r\n[Bridge] Please select a file to run\r\n");
    }
  });

  // Upload single file
  addListener("uploadFileBtn", "click", () => {
    const selectedFile = getSelectedFile();
    if (selectedFile) {
      uploadFile(selectedFile);
    } else {
      termWrite("\r\n[Bridge] Please select a file to upload\r\n");
    }
  });

  // Upload lib folder
  addListener("uploadLibBtn", "click", uploadLib);

  // Upload entire project
  addListener("uploadProjectBtn", "click", uploadProject);

  // Delete all files
  addListener("deleteAllBtn", "click", deleteAllFiles);

  // Stop code
  addListener("stopBtn", "click", stopCode);

  // Soft reset
  addListener("softResetBtn", "click", softReset);

  // Hard reset
  addListener("hardResetBtn", "click", hardReset);

  // Bootloader mode
  addListener("bootloaderBtn", "click", enterBootloader);

  // Firmware download
  addListener("firmwareBtn", "click", downloadFirmware);

  // File picker change
  addListener("filePicker", "change", updateFileButtons);
}

// === Start Application ===

/**
 * Setup device info subscription to update UI
 */
function setupDeviceInfoSubscription() {
  store.subscribe("device", (deviceState) => {
    const deviceInfoEl = getById("deviceInfo");
    if (!deviceInfoEl) return;

    if (deviceState.detected && deviceState.info) {
      const info = deviceState.info;
      const variant = info.variant === "micropython" ? "🐍" : "🐍🔵";
      const variantName =
        info.variant === "micropython" ? "MicroPython" : "CircuitPython";

      // Check if outdated
      const firmwareInfo = getFirmwareInfo();
      const outdatedBadge =
        firmwareInfo && firmwareInfo.isOutdated
          ? ' <span class="badge-outdated" title="Update available">⚠️</span>'
          : "";

      const warningClass = info.variant === "circuitpython" ? "warning" : "";

      deviceInfoEl.innerHTML = `
        <span class="device-name ${warningClass}">${variant} ${info.name}</span>
        <span class="device-version">v${info.version}${outdatedBadge}</span>
      `;
      deviceInfoEl.title = `${info.name}\n${variantName} v${info.version}${
        info.buildDate ? "\nBuild: " + info.buildDate : ""
      }`;
      deviceInfoEl.className = `device-info detected ${warningClass}`;
    } else {
      deviceInfoEl.innerHTML = '<span class="device-name">Not detected</span>';
      deviceInfoEl.title = "Connect to detect device";
      deviceInfoEl.className = "device-info";
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
