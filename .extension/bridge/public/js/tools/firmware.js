/**
 * Firmware Download Module
 * Handles firmware version checking and downloading for various boards.
 */

import { termWrite } from "../terminal/output.js";
import { getDeviceInfo } from "./deviceDetect.js";

// MicroPython board info. `category` controls grouping in the firmware
// dropdown menu; the order here is the display order within each group.
const MICROPYTHON_BOARDS = {
  // Raspberry Pi Pico family
  pico: {
    name: "Raspberry Pi Pico",
    extension: ".uf2",
    category: "Raspberry Pi Pico",
  },
  pico_w: {
    name: "Raspberry Pi Pico W",
    extension: ".uf2",
    category: "Raspberry Pi Pico",
  },
  pico2: {
    name: "Raspberry Pi Pico 2",
    extension: ".uf2",
    category: "Raspberry Pi Pico",
  },
  pico2_w: {
    name: "Raspberry Pi Pico 2 W",
    extension: ".uf2",
    category: "Raspberry Pi Pico",
  },

  // RP2040/RP2350 generic
  rp2040: {
    name: "Generic RP2040",
    extension: ".uf2",
    category: "Generic RP2",
  },
  rp2350: {
    name: "Generic RP2350",
    extension: ".uf2",
    category: "Generic RP2",
  },

  // ESP32 family
  esp32: {
    name: "ESP32",
    extension: ".bin",
    category: "ESP32 / ESP8266",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp32 erase_flash && esptool.py --chip esp32 write_flash -z 0x1000 firmware.bin",
  },
  esp32s2: {
    name: "ESP32-S2",
    extension: ".bin",
    category: "ESP32 / ESP8266",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp32s2 erase_flash && esptool.py --chip esp32s2 write_flash -z 0x1000 firmware.bin",
  },
  esp32s3: {
    name: "ESP32-S3",
    extension: ".bin",
    category: "ESP32 / ESP8266",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp32s3 erase_flash && esptool.py --chip esp32s3 write_flash -z 0 firmware.bin",
  },
  esp32c3: {
    name: "ESP32-C3",
    extension: ".bin",
    category: "ESP32 / ESP8266",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp32c3 erase_flash && esptool.py --chip esp32c3 write_flash -z 0 firmware.bin",
  },
  esp8266: {
    name: "ESP8266",
    extension: ".bin",
    category: "ESP32 / ESP8266",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp8266 erase_flash && esptool.py --chip esp8266 write_flash -z 0 firmware.bin",
  },

  // TinyS3 and other ESP32-S3 boards (use generic S3)
  tinys3: {
    name: "TinyS3 (ESP32-S3)",
    extension: ".bin",
    category: "ESP32 / ESP8266",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp32s3 erase_flash && esptool.py --chip esp32s3 write_flash -z 0 firmware.bin",
  },
};

/**
 * Return the full board catalogue as an array of `{ id, name, category }`
 * entries, preserving the declaration order in MICROPYTHON_BOARDS. The
 * firmware split-button dropdown uses this to render its menu.
 */
export function getAllBoards() {
  return Object.entries(MICROPYTHON_BOARDS).map(([id, info]) => ({
    id,
    name: info.name,
    category: info.category || "Other",
  }));
}

/**
 * Check if firmware is outdated
 * @param {string} currentVersion - Current firmware version
 * @param {string} latestVersion - Latest available version
 * @returns {boolean} True if outdated
 */
export function isOutdated(currentVersion, latestVersion) {
  if (!currentVersion || currentVersion === "unknown") return true;
  if (!latestVersion || latestVersion === "unknown") return false;

  try {
    const current = parseVersion(currentVersion);
    const latest = parseVersion(latestVersion);

    if (current.major < latest.major) return true;
    if (current.major > latest.major) return false;
    if (current.minor < latest.minor) return true;
    if (current.minor > latest.minor) return false;
    if (current.patch < latest.patch) return true;

    return false;
  } catch {
    return true;
  }
}

/**
 * Parse version string into components
 */
function parseVersion(versionStr) {
  const parts = versionStr.split(".").map((p) => parseInt(p) || 0);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

/**
 * Get firmware download info for detected board
 * @returns {object|null} Download info or null
 */
export function getFirmwareInfo() {
  const deviceInfo = getDeviceInfo();
  if (!deviceInfo) return null;

  const boardId = deviceInfo.board;
  const boardInfo = MICROPYTHON_BOARDS[boardId];

  if (!boardInfo) {
    if (deviceInfo.variant === "circuitpython") {
      return {
        name: deviceInfo.name,
        message: `Visit micropython.org to find firmware for your ${deviceInfo.name}`,
        isGeneric: true,
      };
    }
    return null;
  }

  return {
    ...boardInfo,
    boardId,
    currentVersion: deviceInfo.version,
  };
}

/**
 * Fetch latest firmware info from server API. Times out after 20s so a
 * stalled upstream (network egress blocked, micropython.org slow, etc.)
 * surfaces an error in the terminal instead of leaving the user staring
 * at a silent "Fetching..." line forever.
 * @param {string} boardId - Board identifier
 * @returns {Promise<object>} Firmware info
 */
async function fetchLatestFirmware(boardId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(`/api/firmware/latest/${boardId}`, {
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        "timed out waiting for micropython.org (20s) — check network egress",
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (body && body.error) detail = body.error;
    } catch {}
    throw new Error(`Failed to fetch firmware info: ${detail}`);
  }
  return response.json();
}

/**
 * Trigger a cross-origin download/open without using window.open(), which
 * popup-blockers silently swallow when called after an `await` (the user
 * gesture chain is broken). Building an <a> element and clicking it is
 * treated as a navigation rather than a popup, so it works reliably in
 * VS Code webviews / Simple Browser.
 */
function openDownloadUrl(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Download firmware for the detected board
 * Automatically fetches and downloads the latest version
 */
export async function downloadFirmware() {
  const firmwareInfo = getFirmwareInfo();

  if (!firmwareInfo) {
    termWrite(
      "\r\n[Bridge] ❌ No device detected. Connect to a board first.\r\n",
    );
    showFirmwareSelector();
    return;
  }

  if (firmwareInfo.isGeneric) {
    termWrite(`\r\n[Bridge] ${firmwareInfo.message}\r\n`);
    openDownloadUrl("https://micropython.org/download/");
    return;
  }

  termWrite(
    `\r\n[Bridge] 📥 Fetching latest MicroPython for ${firmwareInfo.name}...\r\n`,
  );
  termWrite(`[Bridge] Current version: v${firmwareInfo.currentVersion}\r\n`);

  try {
    // Fetch latest firmware info from our server API
    const latest = await fetchLatestFirmware(firmwareInfo.boardId);

    termWrite(
      `[Bridge] Latest version: v${latest.version} (${latest.buildDate})\r\n`,
    );

    if (!isOutdated(firmwareInfo.currentVersion, latest.version)) {
      termWrite(`[Bridge] ✓ Your firmware is up to date!\r\n`);

      if (!confirm("Your firmware is already up to date. Download anyway?")) {
        return;
      }
    }

    // Start the download
    termWrite(`[Bridge] ⬇️  Downloading ${latest.filename}...\r\n`);
    openDownloadUrl(latest.url);

    termWrite(`[Bridge] ✓ Download started!\r\n`);
    termWrite(`[Bridge]   ${latest.url}\r\n`);

    // Show flashing instructions
    if (firmwareInfo.flashInstructions) {
      termWrite(`\r\n[Bridge] 📋 Flash instructions:\r\n`);
      termWrite(`[Bridge] ${firmwareInfo.flashInstructions}\r\n`);
    } else {
      termWrite(`\r\n[Bridge] 📋 Flash instructions:\r\n`);
      termWrite(
        `[Bridge] 1. Hold BOOTSEL button and plug in USB (or press BOOTSEL + reset)\r\n`,
      );
      termWrite(`[Bridge] 2. A drive named "RPI-RP2" will appear\r\n`);
      termWrite(
        `[Bridge] 3. Drag the ${latest.filename} file to the drive\r\n`,
      );
      termWrite(`[Bridge] 4. Board will reboot automatically\r\n`);
    }
  } catch (err) {
    termWrite(`[Bridge] ❌ Error: ${err.message}\r\n`);
    termWrite(`[Bridge] Opening download page instead...\r\n`);
    openDownloadUrl("https://micropython.org/download/");
  }
}

/**
 * Show firmware selector for manual board selection
 */
export function showFirmwareSelector() {
  termWrite("\r\n[Bridge] Available MicroPython firmware downloads:\r\n");
  termWrite("─".repeat(50) + "\r\n");

  const boards = Object.entries(MICROPYTHON_BOARDS);

  for (const [id, info] of boards) {
    termWrite(`  ${id.padEnd(12)} - ${info.name}\r\n`);
  }

  termWrite("─".repeat(50) + "\r\n");
  termWrite("[Bridge] Connect a board to auto-detect, or visit:\r\n");
  termWrite("[Bridge] https://micropython.org/download/\r\n\r\n");
}

/**
 * Download firmware for a specific board ID
 * @param {string} boardId - Board identifier (e.g., 'pico', 'pico_w')
 */
export async function downloadFirmwareForBoard(boardId) {
  const boardInfo = MICROPYTHON_BOARDS[boardId];

  if (!boardInfo) {
    termWrite(`\r\n[Bridge] ❌ Unknown board: ${boardId}\r\n`);
    showFirmwareSelector();
    return;
  }

  termWrite(
    `\r\n[Bridge] 📥 Fetching latest MicroPython for ${boardInfo.name}...\r\n`,
  );

  try {
    const latest = await fetchLatestFirmware(boardId);

    termWrite(`[Bridge] Latest version: v${latest.version}\r\n`);
    termWrite(`[Bridge] ⬇️  Downloading ${latest.filename}...\r\n`);

    openDownloadUrl(latest.url);

    termWrite(`[Bridge] ✓ Download started!\r\n`);
    termWrite(`[Bridge]   ${latest.url}\r\n`);

    if (boardInfo.flashInstructions) {
      termWrite(`\r\n[Bridge] 📋 Flash instructions:\r\n`);
      termWrite(`[Bridge] ${boardInfo.flashInstructions}\r\n`);
    } else {
      termWrite(`\r\n[Bridge] 📋 Flash instructions:\r\n`);
      termWrite(`[Bridge] 1. Hold BOOTSEL button and plug in USB\r\n`);
      termWrite(`[Bridge] 2. Drag the .uf2 file to the RPI-RP2 drive\r\n`);
    }
  } catch (err) {
    termWrite(`[Bridge] ❌ Error: ${err.message}\r\n`);
    termWrite(`[Bridge] Opening download page instead...\r\n`);
    openDownloadUrl("https://micropython.org/download/");
  }
}

/**
 * Get all supported boards
 */
export function getSupportedBoards() {
  return Object.entries(MICROPYTHON_BOARDS).map(([id, info]) => ({
    id,
    name: info.name,
  }));
}
