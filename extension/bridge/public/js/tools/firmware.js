/**
 * Firmware Download Module
 * Handles firmware version checking and downloading for various boards.
 */

import * as store from "../state/store.js";
import { termWrite } from "../terminal/output.js";
import { getDeviceInfo } from "./deviceDetect.js";

// MicroPython board info
const MICROPYTHON_BOARDS = {
  // Raspberry Pi Pico family
  pico: {
    name: "Raspberry Pi Pico",
    extension: ".uf2",
  },
  pico_w: {
    name: "Raspberry Pi Pico W",
    extension: ".uf2",
  },
  pico2: {
    name: "Raspberry Pi Pico 2",
    extension: ".uf2",
  },

  // RP2040/RP2350 generic
  rp2040: {
    name: "Generic RP2040",
    extension: ".uf2",
  },
  rp2350: {
    name: "Generic RP2350",
    extension: ".uf2",
  },

  // ESP32 family
  esp32: {
    name: "ESP32",
    extension: ".bin",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp32 erase_flash && esptool.py --chip esp32 write_flash -z 0x1000 firmware.bin",
  },
  esp32s2: {
    name: "ESP32-S2",
    extension: ".bin",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp32s2 erase_flash && esptool.py --chip esp32s2 write_flash -z 0x1000 firmware.bin",
  },
  esp32s3: {
    name: "ESP32-S3",
    extension: ".bin",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp32s3 erase_flash && esptool.py --chip esp32s3 write_flash -z 0 firmware.bin",
  },
  esp32c3: {
    name: "ESP32-C3",
    extension: ".bin",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp32c3 erase_flash && esptool.py --chip esp32c3 write_flash -z 0 firmware.bin",
  },
  esp8266: {
    name: "ESP8266",
    extension: ".bin",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp8266 erase_flash && esptool.py --chip esp8266 write_flash -z 0 firmware.bin",
  },

  // TinyS3 and other ESP32-S3 boards (use generic S3)
  tinys3: {
    name: "TinyS3 (ESP32-S3)",
    extension: ".bin",
    flashInstructions:
      "Use esptool.py: esptool.py --chip esp32s3 erase_flash && esptool.py --chip esp32s3 write_flash -z 0 firmware.bin",
  },
};

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
 * Fetch latest firmware info from server API
 * @param {string} boardId - Board identifier
 * @returns {Promise<object>} Firmware info
 */
async function fetchLatestFirmware(boardId) {
  const response = await fetch(`/api/firmware/latest/${boardId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch firmware info: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Download firmware for the detected board
 * Automatically fetches and downloads the latest version
 */
export async function downloadFirmware() {
  const firmwareInfo = getFirmwareInfo();

  if (!firmwareInfo) {
    termWrite(
      "\r\n[Bridge] ❌ No device detected. Connect to a board first.\r\n"
    );
    showFirmwareSelector();
    return;
  }

  if (firmwareInfo.isGeneric) {
    termWrite(`\r\n[Bridge] ${firmwareInfo.message}\r\n`);
    window.open("https://micropython.org/download/", "_blank");
    return;
  }

  termWrite(
    `\r\n[Bridge] 📥 Fetching latest MicroPython for ${firmwareInfo.name}...\r\n`
  );
  termWrite(`[Bridge] Current version: v${firmwareInfo.currentVersion}\r\n`);

  try {
    // Fetch latest firmware info from our server API
    const latest = await fetchLatestFirmware(firmwareInfo.boardId);

    termWrite(
      `[Bridge] Latest version: v${latest.version} (${latest.buildDate})\r\n`
    );

    if (!isOutdated(firmwareInfo.currentVersion, latest.version)) {
      termWrite(`[Bridge] ✓ Your firmware is up to date!\r\n`);

      if (!confirm("Your firmware is already up to date. Download anyway?")) {
        return;
      }
    }

    // Start the download
    termWrite(`[Bridge] ⬇️  Downloading ${latest.filename}...\r\n`);
    window.open(latest.url, "_blank");

    termWrite(`[Bridge] ✓ Download started!\r\n`);

    // Show flashing instructions
    if (firmwareInfo.flashInstructions) {
      termWrite(`\r\n[Bridge] 📋 Flash instructions:\r\n`);
      termWrite(`[Bridge] ${firmwareInfo.flashInstructions}\r\n`);
    } else {
      termWrite(`\r\n[Bridge] 📋 Flash instructions:\r\n`);
      termWrite(
        `[Bridge] 1. Hold BOOTSEL button and plug in USB (or press BOOTSEL + reset)\r\n`
      );
      termWrite(`[Bridge] 2. A drive named "RPI-RP2" will appear\r\n`);
      termWrite(
        `[Bridge] 3. Drag the ${latest.filename} file to the drive\r\n`
      );
      termWrite(`[Bridge] 4. Board will reboot automatically\r\n`);
    }
  } catch (err) {
    termWrite(`[Bridge] ❌ Error: ${err.message}\r\n`);
    termWrite(`[Bridge] Opening download page instead...\r\n`);
    window.open("https://micropython.org/download/", "_blank");
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
    `\r\n[Bridge] 📥 Fetching latest MicroPython for ${boardInfo.name}...\r\n`
  );

  try {
    const latest = await fetchLatestFirmware(boardId);

    termWrite(`[Bridge] Latest version: v${latest.version}\r\n`);
    termWrite(`[Bridge] ⬇️  Downloading ${latest.filename}...\r\n`);

    window.open(latest.url, "_blank");

    termWrite(`[Bridge] ✓ Download started!\r\n`);

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
    window.open("https://micropython.org/download/", "_blank");
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
