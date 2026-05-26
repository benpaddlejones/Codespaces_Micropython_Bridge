/**
 * Raw REPL Module
 * Handles MicroPython raw REPL protocol for executing code on Pico.
 */

import * as store from "../state/store.js";
import { sleep } from "./connection.js";

// --- Wait-budget heuristics ----------------------------------------------
// At 115200 8N1, the line carries ~10,400 bytes/sec (8 data + start + stop).
// In sendRawCommand below we further throttle to 128-byte chunks with 5 ms
// gaps, so realistic TX throughput is ~25,600 bytes/sec worst case. We use
// the conservative wire estimate for the wait budget — overestimating is
// cheap, underestimating loses files.
const TX_BYTES_PER_SEC = 10400;
// Device-side budget: parse one long Python line, base64-decode it, write
// to LittleFS. Empirically a Pico W manages ≥ 50 KB/s for this path,
// so 0.1 ms/byte (= 10 KB/s) is a generous floor that still keeps a
// 32 KB upload under 4 s of post-send wait instead of 20+ s.
const DEVICE_BUDGET_PER_BYTE_MS = 0.1;
const WAIT_FLOOR_MS = 500;

/**
 * Compute a safe wait window for a given Python payload size.
 * @param {number} codeBytes - length of the Python source we're sending
 * @param {number} payloadBytes - additional bytes the device must process
 *   (e.g. the size of a file being written). Defaults to 0.
 */
export function computeWaitMs(codeBytes, payloadBytes = 0) {
  const txMs = Math.ceil((codeBytes / TX_BYTES_PER_SEC) * 1000);
  const procMs = Math.ceil(payloadBytes * DEVICE_BUDGET_PER_BYTE_MS);
  return WAIT_FLOOR_MS + txMs + procMs;
}

/**
 * Send raw command to Pico via raw REPL mode
 * @param {string} code - Python code to execute
 * @param {number} waitMs - Wait time after execution. If omitted, a value
 *   is derived from the code length using computeWaitMs(). Pass an
 *   explicit number to override (e.g. when you know the device work is
 *   negligible and the default would be wasteful).
 */
export async function sendRawCommand(code, waitMs) {
  const writer = store.getWriter();
  if (!writer) {
    throw new Error("Not connected to Pico");
  }

  const effectiveWait =
    typeof waitMs === "number" ? waitMs : computeWaitMs(code.length);

  // Single Ctrl+C to interrupt any running code
  await writer.write("\x03");
  await sleep(50);

  // Enter raw REPL mode: Ctrl+A
  await writer.write("\x01");
  await sleep(100);

  // Send the code in chunks to avoid buffer issues. 256-byte chunks with
  // a 2 ms gap give ~110 KB/s on the host side — well under the USB CDC
  // FIFO size and within the Pico's parse rate.
  const chunkSize = 256;
  for (let i = 0; i < code.length; i += chunkSize) {
    const chunk = code.slice(i, i + chunkSize);
    await writer.write(chunk);
    await sleep(2);
  }

  // Execute: Ctrl+D
  await writer.write("\x04");

  // Wait for execution to complete
  await sleep(effectiveWait);

  // Exit raw REPL: Ctrl+B
  await writer.write("\x02");
  await sleep(50);

  // Friendly REPL doesn't redraw `>>>` until it sees a CR; without
  // this, the cursor sits on a blank line until the user hits Enter.
  try {
    await writer.write("\r");
  } catch (_e) {
    /* connection may have closed mid-flight */
  }
}

/**
 * Like sendRawCommand but captures everything the device prints during
 * execution and returns it. Used by upload verification.
 *
 * NOTE: silentMode is toggled on for the duration so the raw REPL chatter
 * (\x04 markers, OK acks, etc.) doesn't leak into the user-facing
 * terminal. Restored on exit even if an error is thrown.
 */
export async function sendRawCommandAndCapture(code, waitMs) {
  const wasSilent = store.isSilentMode();
  store.setSilentMode(true);
  store.startCapture();
  try {
    await sendRawCommand(code, waitMs);
    // Small grace period so any trailing bytes already in flight land in
    // the capture buffer before we read it.
    await sleep(100);
    return store.stopCaptureAndGet();
  } finally {
    if (store.isCapturing()) store.stopCaptureAndGet();
    store.setSilentMode(wasSilent);
  }
}

// --- Marker-based completion (Layer 4) -----------------------------------
// Counter so every concurrent send_until_marker gets a unique sentinel.
let _markerSeq = 0;

/**
 * Generate a fresh unique marker token suitable for embedding in a
 * `print(...)` statement at the end of a Python payload. The token uses
 * only ASCII chars that are safe inside both Python string literals and
 * regex-free substring search.
 */
export function newMarker(tag = "DONE") {
  _markerSeq = (_markerSeq + 1) & 0x7fffffff;
  return `__BRIDGE_${tag}_${Date.now().toString(36)}_${_markerSeq}__`;
}

/**
 * Send `code` over raw REPL and resolve AS SOON AS the device prints
 * `marker` (instead of sleeping for the worst-case wait budget). Falls
 * back to `maxWaitMs` as a hard upper bound so a missing marker can
 * never deadlock the UI.
 *
 * This is the Layer 4 of the upload pipeline: Layer 1 was payload-aware
 * wait, Layer 2 was critical-last ordering, Layer 3 was verify+retry,
 * and Layer 4 here removes the blind sleep entirely on the happy path.
 *
 * @param {string} code - Python source. Must include a
 *   `print('${marker}')` line at the point completion should be signalled.
 * @param {string} marker - Unique sentinel string (use {@link newMarker}).
 * @param {number} [maxWaitMs] - Hard timeout. Defaults to 3x the
 *   payload-aware estimate; that's enough headroom for a slow Pico
 *   without letting a stuck device hang the UI forever.
 * @returns {Promise<{found: boolean, elapsedMs: number, output: string}>}
 */
export async function sendRawCommandUntilMarker(code, marker, maxWaitMs) {
  const writer = store.getWriter();
  if (!writer) {
    throw new Error("Not connected to Pico");
  }
  if (!marker || typeof marker !== "string") {
    throw new Error("sendRawCommandUntilMarker: marker is required");
  }

  // Hard upper bound: 3x the payload-aware estimate, never less than 2 s.
  const hardCap =
    typeof maxWaitMs === "number"
      ? maxWaitMs
      : Math.max(2000, computeWaitMs(code.length) * 3);

  // Poll interval: short enough to feel instant on small files, long
  // enough to keep CPU wake noise off the UI thread.
  const POLL_MS = 20;

  const wasSilent = store.isSilentMode();
  store.setSilentMode(true);
  store.startCapture();
  const t0 = performance.now();
  let found = false;

  try {
    // Single Ctrl+C to interrupt any running code, then enter raw REPL.
    await writer.write("\x03");
    await sleep(50);
    await writer.write("\x01");
    await sleep(100);

    // Send the code (same chunking as sendRawCommand).
    const chunkSize = 256;
    for (let i = 0; i < code.length; i += chunkSize) {
      const chunk = code.slice(i, i + chunkSize);
      await writer.write(chunk);
      await sleep(2);
    }

    // Execute: Ctrl+D
    await writer.write("\x04");

    // Poll the capture buffer for the marker.
    while (performance.now() - t0 < hardCap) {
      // Peek without consuming so other code paths can also see it.
      const buf = store.peekCapture ? store.peekCapture() : null;
      if (buf && buf.includes(marker)) {
        found = true;
        break;
      }
      // Fallback for older store versions: stop+restart capture is
      // destructive, so only use it if peekCapture isn't available.
      if (!store.peekCapture) {
        // Should not happen post-2.1.11; here as a defensive guard.
        const snapshot = store.stopCaptureAndGet();
        if (snapshot.includes(marker)) {
          store.startCapture();
          store.appendCapture(snapshot); // restore so callers see it
          found = true;
          break;
        }
        store.startCapture();
        store.appendCapture(snapshot);
      }
      await sleep(POLL_MS);
    }

    // Exit raw REPL: Ctrl+B
    await writer.write("\x02");
    await sleep(20);
    // Nudge friendly REPL into redrawing its `>>>` prompt.
    try {
      await writer.write("\r");
    } catch (_e) {
      /* connection may have closed mid-flight */
    }

    const output = store.stopCaptureAndGet();
    return { found, elapsedMs: performance.now() - t0, output };
  } finally {
    if (store.isCapturing()) store.stopCaptureAndGet();
    store.setSilentMode(wasSilent);
  }
}

/**
 * Send interrupt signal (Ctrl+C)
 */
export async function sendInterrupt() {
  const writer = store.getWriter();
  if (!writer) return;

  await writer.write("\x03");
  await sleep(100);
  await writer.write("\x03");
  await sleep(100);
  await writer.write("\x02"); // Ctrl+B to ensure normal REPL mode
  // Nudge friendly REPL into redrawing its `>>>` prompt.
  try {
    await writer.write("\r");
  } catch (_e) {
    /* ignore */
  }
}

/**
 * Send soft reset (Ctrl+D in normal REPL)
 */
export async function sendSoftReset() {
  const writer = store.getWriter();
  if (!writer) return;

  await writer.write("\x03"); // Ctrl+C to interrupt
  await sleep(100);
  await writer.write("\x04"); // Ctrl+D for soft reset
}

/**
 * Trigger hard reset via machine.reset()
 */
export async function sendHardReset() {
  const writer = store.getWriter();
  if (!writer) return;

  await writer.write("\x03"); // Ctrl+C to interrupt
  await sleep(100);
  await writer.write("\x01"); // Enter raw REPL
  await sleep(100);
  await writer.write("import machine\nmachine.reset()\x04"); // Execute + Ctrl+D
}

/**
 * Enter bootloader mode for firmware updates
 */
export async function enterBootloader() {
  const writer = store.getWriter();
  if (!writer) return;

  await writer.write("\x03"); // Ctrl+C to interrupt
  await sleep(100);
  await writer.write("\x01"); // Enter raw REPL
  await sleep(100);
  await writer.write("import machine\nmachine.bootloader()\x04"); // Execute + Ctrl+D
}

/**
 * Ensure a directory exists on Pico (creates nested dirs)
 * @param {string} dirPath - Directory path to create
 */
export async function ensureDirectory(dirPath) {
  const parts = dirPath.split("/").filter((p) => p);
  let currentPath = "";

  for (const part of parts) {
    currentPath += "/" + part;
    await sendRawCommand(
      `import os\ntry:\n    os.mkdir('${currentPath}')\nexcept:\n    pass`,
    );
    await sleep(100);
  }
}
