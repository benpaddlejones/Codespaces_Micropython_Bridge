/**
 * Device Detection Module
 * Detects board type and Python variant (MicroPython vs CircuitPython).
 */

import * as store from "../state/store.js";
import { termWrite } from "../terminal/output.js";

// Known board signatures from REPL banners.
//
// IMPORTANT: ordering matters — first match wins, so the most specific
// variants (Pico 2 W, Pico W) MUST come before the generic ones (Pico 2,
// Pico). Also note the trailing `\b` (word boundary) after every `W`:
// without it `/Pico W/` happily matches the substring `Pico W` inside
// `Raspberry Pi Pico with RP2040` (the banner a Pico/Pico H reports),
// causing a Pico H to be mis-detected as a Pico W.
const BOARD_PATTERNS = [
  // MicroPython boards
  {
    pattern: /MicroPython.*Raspberry Pi Pico 2 W\b/i,
    board: "pico2_w",
    variant: "micropython",
    name: "Raspberry Pi Pico 2 W",
  },
  {
    pattern: /MicroPython.*Raspberry Pi Pico W\b/i,
    board: "pico_w",
    variant: "micropython",
    name: "Raspberry Pi Pico W",
  },
  {
    pattern: /MicroPython.*Raspberry Pi Pico 2\b/i,
    board: "pico2",
    variant: "micropython",
    name: "Raspberry Pi Pico 2",
  },
  {
    pattern: /MicroPython.*Raspberry Pi Pico\b/i,
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

  // CircuitPython boards (same ordering + word-boundary rules as above)
  {
    pattern: /CircuitPython.*TinyS3/i,
    board: "tinys3",
    variant: "circuitpython",
    name: "TinyS3",
  },
  {
    pattern: /CircuitPython.*Pico 2 W\b/i,
    board: "pico2_w",
    variant: "circuitpython",
    name: "Raspberry Pi Pico 2 W",
  },
  {
    pattern: /CircuitPython.*Pico W\b/i,
    board: "pico_w",
    variant: "circuitpython",
    name: "Raspberry Pi Pico W",
  },
  {
    pattern: /CircuitPython.*Pico 2\b/i,
    board: "pico2",
    variant: "circuitpython",
    name: "Raspberry Pi Pico 2",
  },
  {
    pattern: /CircuitPython.*Pico\b/i,
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
let spinnerInterval = null;
let spinnerVisible = false;

const SPINNER_FRAMES = ["   ", ".  ", ".. ", "..."];
const SPINNER_LABEL = "[Bridge] Detecting device";

function startSpinner() {
  stopSpinner();
  let frame = 0;
  // Start on a fresh row and clear to end-of-line so we don't inherit any
  // pre-silent-mode REPL chatter (e.g. an echoed ">>> ") that would shift
  // our label rightward and leave stray characters past the spinner when
  // later frames overwrite cols 0..N only.
  termWrite(`\r\x1b[K${SPINNER_LABEL}${SPINNER_FRAMES[0]}`);
  spinnerVisible = true;
  spinnerInterval = setInterval(() => {
    frame = (frame + 1) % SPINNER_FRAMES.length;
    // \r returns to column 0; \x1b[K erases from cursor to end of line so
    // any leftover characters past the spinner width are removed too.
    termWrite(`\r${SPINNER_LABEL}${SPINNER_FRAMES[frame]}\x1b[K`);
  }, 200);
}

function stopSpinner() {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  if (spinnerVisible) {
    // Wipe the entire spinner row using ANSI erase-to-end-of-line, then
    // leave the cursor at column 0 so the next writer takes over cleanly.
    termWrite(`\r\x1b[K`);
    spinnerVisible = false;
  }
}

/**
 * Start device detection by analyzing REPL output
 */
export function startDetection() {
  detectionBuffer = "";
  store.setDeviceInfo(null);

  // Silence the raw REPL banner while we're detecting so the animated
  // spinner isn't immediately trampled by the device's boot output.
  // We still capture the data (the read loop appends to the capture
  // buffer before checking silent mode), so detection still works.
  store.setSilentMode(true);

  startSpinner();

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
  if (!detectionBuffer) {
    stopSpinner();
    store.setSilentMode(false);
    return;
  }

  const info = parseDeviceInfo(detectionBuffer);

  stopSpinner();
  // Re-enable raw REPL output now that the spinner is gone.
  store.setSilentMode(false);

  if (info) {
    store.setDeviceInfo(info);
    announceDevice(info);

    // Check if using CircuitPython when MicroPython is expected
    if (info.variant === "circuitpython") {
      warnCircuitPython(info);
    }
  }

  detectionBuffer = "";

  // Nudge the friendly REPL so a fresh `>>>` prompt is drawn under our
  // detection message — otherwise the cursor sits on a blank line and
  // the user has to press Enter before they can type anything.
  nudgeReplPrompt();
}

/**
 * Send a single CR to the device so the friendly REPL redraws its
 * `>>>` prompt. Safe no-op if the writer isn't ready.
 */
function nudgeReplPrompt() {
  const writer = store.getWriter();
  if (!writer) return;
  try {
    // Fire-and-forget; we don't want to block the detection callback.
    void writer.write("\r");
  } catch (_e) {
    /* ignore */
  }
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
  const variantName =
    info.variant === "micropython" ? "MicroPython" : "CircuitPython";
  const msg =
    `\r\n[Bridge] ${variantIcon} Detected: ${info.name} running ${variantName} v${info.version}` +
    ` — refreshing device file list…\r\n`;
  termWrite(msg);
}

/**
 * Warn user about CircuitPython compatibility
 */
function warnCircuitPython(_info) {
  termWrite(
    "\r\n[Bridge] ⚠️  WARNING: CircuitPython detected!\r\n" +
      "[Bridge] This bridge is designed for MicroPython.\r\n" +
      "[Bridge] Raw REPL commands may not work correctly.\r\n" +
      "[Bridge] Consider flashing MicroPython firmware.\r\n" +
      '[Bridge] Use the "Download Firmware" button to get the latest MicroPython.\r\n\r\n',
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
