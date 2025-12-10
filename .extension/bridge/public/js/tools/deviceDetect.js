/**
 * Device Detection Module
 * Detects board type and Python variant (MicroPython vs CircuitPython).
 */

import * as store from "../state/store.js";
import { termWrite } from "../terminal/output.js";

// Known board signatures from REPL banners
const BOARD_PATTERNS = [
  // MicroPython boards
  {
    pattern: /MicroPython.*Raspberry Pi Pico W/i,
    board: "pico_w",
    variant: "micropython",
    name: "Raspberry Pi Pico W",
  },
  {
    pattern: /MicroPython.*Raspberry Pi Pico 2/i,
    board: "pico2",
    variant: "micropython",
    name: "Raspberry Pi Pico 2",
  },
  {
    pattern: /MicroPython.*Raspberry Pi Pico/i,
    board: "pico",
    variant: "micropython",
    name: "Raspberry Pi Pico",
  },
  {
    pattern: /MicroPython.*RP2040/i,
    board: "rp2040",
    variant: "micropython",
    name: "RP2040 Board",
  },
  {
    pattern: /MicroPython.*RP2350/i,
    board: "rp2350",
    variant: "micropython",
    name: "RP2350 Board",
  },
  {
    pattern: /MicroPython.*ESP32-S3/i,
    board: "esp32s3",
    variant: "micropython",
    name: "ESP32-S3",
  },
  {
    pattern: /MicroPython.*ESP32-S2/i,
    board: "esp32s2",
    variant: "micropython",
    name: "ESP32-S2",
  },
  {
    pattern: /MicroPython.*ESP32-C3/i,
    board: "esp32c3",
    variant: "micropython",
    name: "ESP32-C3",
  },
  {
    pattern: /MicroPython.*ESP32/i,
    board: "esp32",
    variant: "micropython",
    name: "ESP32",
  },
  {
    pattern: /MicroPython.*ESP8266/i,
    board: "esp8266",
    variant: "micropython",
    name: "ESP8266",
  },
  {
    pattern: /MicroPython/i,
    board: "unknown",
    variant: "micropython",
    name: "MicroPython Board",
  },

  // CircuitPython boards
  {
    pattern: /CircuitPython.*TinyS3/i,
    board: "tinys3",
    variant: "circuitpython",
    name: "TinyS3",
  },
  {
    pattern: /CircuitPython.*Pico W/i,
    board: "pico_w",
    variant: "circuitpython",
    name: "Raspberry Pi Pico W",
  },
  {
    pattern: /CircuitPython.*Pico 2/i,
    board: "pico2",
    variant: "circuitpython",
    name: "Raspberry Pi Pico 2",
  },
  {
    pattern: /CircuitPython.*Pico/i,
    board: "pico",
    variant: "circuitpython",
    name: "Raspberry Pi Pico",
  },
  {
    pattern: /CircuitPython.*ESP32-S3/i,
    board: "esp32s3",
    variant: "circuitpython",
    name: "ESP32-S3",
  },
  {
    pattern: /CircuitPython.*ESP32-S2/i,
    board: "esp32s2",
    variant: "circuitpython",
    name: "ESP32-S2",
  },
  {
    pattern: /CircuitPython/i,
    board: "unknown",
    variant: "circuitpython",
    name: "CircuitPython Board",
  },
];

// Version extraction patterns
const VERSION_PATTERNS = {
  micropython: /MicroPython\s+v?([\d.]+)/i,
  circuitpython: /CircuitPython\s+([\d.]+)/i,
};

// Buffer to accumulate REPL output for detection
let detectionBuffer = "";
let detectionTimeout = null;
let detectionCallback = null;

/**
 * Start device detection by analyzing REPL output
 */
export function startDetection() {
  detectionBuffer = "";
  store.setDeviceInfo(null);

  // Set up a timeout to process whatever we've collected
  if (detectionTimeout) {
    clearTimeout(detectionTimeout);
  }
  detectionTimeout = setTimeout(() => {
    processDetectionBuffer();
  }, 2000);
}

/**
 * Feed data into the detection buffer
 * @param {string} data - Serial data received
 */
export function feedDetectionData(data) {
  detectionBuffer += data;

  // Check if we have enough data to detect
  if (
    detectionBuffer.includes(">>>") ||
    detectionBuffer.includes("MicroPython") ||
    detectionBuffer.includes("CircuitPython")
  ) {
    // Reset timeout and process sooner
    if (detectionTimeout) {
      clearTimeout(detectionTimeout);
    }
    detectionTimeout = setTimeout(() => {
      processDetectionBuffer();
    }, 500);
  }
}

/**
 * Process the detection buffer to identify device
 */
function processDetectionBuffer() {
  if (!detectionBuffer) return;

  const info = parseDeviceInfo(detectionBuffer);

  if (info) {
    store.setDeviceInfo(info);
    announceDevice(info);

    // Check if using CircuitPython when MicroPython is expected
    if (info.variant === "circuitpython") {
      warnCircuitPython(info);
    }
  }

  detectionBuffer = "";
}

/**
 * Parse device info from REPL banner
 * @param {string} text - REPL output text
 * @returns {object|null} Device info or null
 */
export function parseDeviceInfo(text) {
  // Try each board pattern
  for (const { pattern, board, variant, name } of BOARD_PATTERNS) {
    if (pattern.test(text)) {
      // Extract version
      const versionPattern = VERSION_PATTERNS[variant];
      const versionMatch = text.match(versionPattern);
      const version = versionMatch ? versionMatch[1] : "unknown";

      // Extract date if available
      const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
      const buildDate = dateMatch ? dateMatch[1] : null;

      return {
        board,
        variant,
        name,
        version,
        buildDate,
        raw: text.substring(0, 500), // Keep first 500 chars for debugging
      };
    }
  }

  return null;
}

/**
 * Announce detected device to terminal
 */
function announceDevice(info) {
  const variantIcon = info.variant === "micropython" ? "🐍" : "🐍🔵";
  const msg = `\r\n[Bridge] ${variantIcon} Detected: ${info.name} running ${
    info.variant === "micropython" ? "MicroPython" : "CircuitPython"
  } v${info.version}\r\n`;
  termWrite(msg);
}

/**
 * Warn user about CircuitPython compatibility
 */
function warnCircuitPython(info) {
  termWrite(
    "\r\n[Bridge] ⚠️  WARNING: CircuitPython detected!\r\n" +
      "[Bridge] This bridge is designed for MicroPython.\r\n" +
      "[Bridge] Raw REPL commands may not work correctly.\r\n" +
      "[Bridge] Consider flashing MicroPython firmware.\r\n" +
      '[Bridge] Use the "Download Firmware" button to get the latest MicroPython.\r\n\r\n'
  );
}

/**
 * Check if device is running MicroPython
 */
export function isMicroPython() {
  const info = store.getDeviceInfo();
  return info && info.variant === "micropython";
}

/**
 * Check if device is running CircuitPython
 */
export function isCircuitPython() {
  const info = store.getDeviceInfo();
  return info && info.variant === "circuitpython";
}

/**
 * Get the detected device info
 */
export function getDeviceInfo() {
  return store.getDeviceInfo();
}
