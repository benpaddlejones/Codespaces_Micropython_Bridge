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
import { setupPlotterEventListeners } from "./plotter/controls.js";
import {
  changeBaudRate,
  connect,
  disconnect,
  sendData,
} from "./serial/index.js";
import { initSocket, setupRestartButton } from "./socket/index.js";
import * as store from "./state/store.js";
import { initTerminalControls } from "./terminal/controls.js";
import { setupKeyboardHandlers } from "./terminal/handlers.js";
import { initTerminal, writeWelcomeMessage } from "./terminal/index.js";
import { clearOutput, downloadLog, termWrite } from "./terminal/output.js";
import { getSelectedFile, loadWorkspaceFiles } from "./tools/fileManager.js";
import {
  downloadFirmware,
  downloadFirmwareForBoard,
  getAllBoards,
  getFirmwareInfo,
} from "./tools/firmware.js";
import {
  enterBootloader,
  hardReset,
  softReset,
  stopCode,
} from "./tools/picoControl.js";
import {
  deleteAllFiles,
  listPicoFiles,
  runFile,
  uploadFile,
  uploadLib,
  uploadProject,
} from "./tools/picoSync.js";
import { addListener, getById, getValue, setValue } from "./ui/dom.js";
import { initPinoutViewer } from "./ui/pinout.js";
import { initStatusUI, updateFileButtons } from "./ui/status.js";

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
    initTerminalControls(getById("main-content"));
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
  initPinoutViewer();

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
  addListener("refreshFilesBtn", "click", () => {
    loadWorkspaceFiles();
  });

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
  setupFirmwareDropdown();

  // File picker change
  addListener("filePicker", "change", updateFileButtons);
  // Ensure refresh button stays enabled regardless of connection state
  const refreshBtn = getById("refreshFilesBtn");
  if (refreshBtn) {
    refreshBtn.disabled = false;
  }
}

/**
 * Build the firmware split-button dropdown menu. Bootstrap's dropdown
 * component handles open/close, outside-click, ESC, focus, and viewport
 * positioning. We only populate the menu and wire each item to
 * downloadFirmwareForBoard(). The main `⬇️ Firmware` button still runs
 * auto-detect; this dropdown lets the user override when auto-detect is
 * wrong (e.g. a Pico H running Pico W firmware that reports itself as
 * "Pico W").
 */
function setupFirmwareDropdown() {
  const toggleBtn = getById("firmwareDropdownBtn");
  const menu = getById("firmwareMenu");
  if (!toggleBtn || !menu) return;

  // Populate menu: grouped by `category`, in declaration order.
  const boards = getAllBoards();
  const groups = new Map();
  for (const b of boards) {
    if (!groups.has(b.category)) groups.set(b.category, []);
    groups.get(b.category).push(b);
  }

  menu.innerHTML = "";
  let firstGroup = true;
  for (const [category, items] of groups) {
    if (!firstGroup) {
      const divLi = document.createElement("li");
      divLi.innerHTML = '<hr class="dropdown-divider">';
      menu.appendChild(divLi);
    }
    firstGroup = false;

    const headerLi = document.createElement("li");
    const headerEl = document.createElement("h6");
    headerEl.className = "dropdown-header";
    headerEl.textContent = category;
    headerLi.appendChild(headerEl);
    menu.appendChild(headerLi);

    for (const b of items) {
      const li = document.createElement("li");
      const item = document.createElement("button");
      item.type = "button";
      item.className = "dropdown-item d-flex justify-content-between";
      item.dataset.boardId = b.id;
      item.innerHTML = `<span>${b.name}</span><span class="text-muted small ms-3">${b.id}</span>`;
      item.addEventListener("click", () => {
        downloadFirmwareForBoard(b.id);
      });
      li.appendChild(item);
      menu.appendChild(li);
    }
  }

  // When the menu is about to open, highlight the auto-detected board
  // so the user can see what the main button would have picked.
  toggleBtn.addEventListener("show.bs.dropdown", () => {
    const detected = getFirmwareInfo();
    const detectedId = detected && detected.boardId;
    for (const el of menu.querySelectorAll(".dropdown-item")) {
      el.classList.toggle("active", el.dataset.boardId === detectedId);
    }
  });
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
