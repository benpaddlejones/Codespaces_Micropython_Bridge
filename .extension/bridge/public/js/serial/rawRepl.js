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

// --- Raw REPL protocol markers -------------------------------------------
// Standard MicroPython raw REPL framing. After Ctrl-A the device prints the
// banner; after Ctrl-D it replies `OK`, then stdout, then \x04, then any
// traceback, then \x04>. We watch for these instead of sleeping blindly
// (the approach Arduino's micropython.js uses). Every wait falls back to a
// time budget so a device that drops a byte — or doesn't speak the exact
// protocol — can never deadlock the UI.
const RAW_REPL_BANNER = "raw REPL; CTRL-B to exit";
const EXEC_END_MARKER = "\x04>";
const BANNER_WAIT_MS = 500;

/**
 * Poll the capture buffer until `needle` appears or `hardCapMs` elapses.
 * Falls back to a plain sleep when the store can't be peeked.
 * @returns {Promise<boolean>} true if the needle was observed.
 */
async function waitForInCapture(needle, hardCapMs, pollMs = 20) {
  if (!store.peekCapture) {
    await sleep(hardCapMs);
    return false;
  }
  const t0 = performance.now();
  while (performance.now() - t0 < hardCapMs) {
    const buf = store.peekCapture();
    if (buf && buf.includes(needle)) return true;
    await sleep(pollMs);
  }
  return false;
}

/**
 * Parse a raw-REPL execution result frame.
 * Frame shape: `OK<stdout>\x04<stderr>\x04>`.
 * @param {string} buffer - capture buffer that contains the frame.
 * @returns {{ok: boolean, stdout: string, stderr: string}}
 */
export function parseRawResult(buffer) {
  const text = typeof buffer === "string" ? buffer : "";
  const endIdx = text.lastIndexOf(EXEC_END_MARKER);
  if (endIdx === -1) {
    // No frame end seen (e.g. blind-sleep fallback path) — treat the whole
    // buffer as stdout and assume success.
    return { ok: true, stdout: text, stderr: "" };
  }
  const frame = text.slice(0, endIdx); // OK<stdout>\x04<stderr>
  const sepIdx = frame.lastIndexOf("\x04");
  const stderr = sepIdx === -1 ? "" : frame.slice(sepIdx + 1);
  const body = sepIdx === -1 ? frame : frame.slice(0, sepIdx); // OK<stdout>
  const okIdx = body.indexOf("OK");
  const stdout = okIdx === -1 ? body : body.slice(okIdx + 2);
  return { ok: stderr.trim() === "", stdout, stderr };
}

/**
 * Core raw-REPL exec shared by {@link sendRawCommand} and
 * {@link sendRawCommandUntilMarker}. Handles capture, the entry-banner
 * handshake, chunked send, and completion detection (a caller marker and/or
 * the device's `\x04>` frame end), all bounded by a hard time cap.
 *
 * @param {string} code - Python source to run.
 * @param {{waitMs?: number, marker?: string, hardCap?: number}} [opts]
 * @returns {Promise<{found: boolean, elapsedMs: number, output: string}>}
 */
async function rawExec(code, opts = {}) {
  const writer = store.getWriter();
  if (!writer) {
    throw new Error("Not connected to Pico");
  }

  const { marker } = opts;
  const effectiveWait =
    typeof opts.waitMs === "number" ? opts.waitMs : computeWaitMs(code.length);
  // For marker-bearing payloads keep the historical 3x headroom; otherwise
  // the per-exec frame end (\x04>) arrives quickly, so the budget is just a
  // safety net and need never exceed the old blind-sleep duration.
  const hardCap =
    typeof opts.hardCap === "number"
      ? opts.hardCap
      : marker
        ? Math.max(2000, effectiveWait * 3)
        : effectiveWait;

  // Only manage capture if nobody upstream already is, so we never clobber
  // an outer capture (e.g. sendRawCommandAndCapture).
  const ownsCapture = !store.isCapturing();
  if (ownsCapture) store.startCapture();

  const t0 = performance.now();
  let found = false;
  try {
    // Double Ctrl-C (CR first) reliably breaks a running loop before we
    // enter raw mode — matches pyboard.py / Arduino micropython.js.
    await writer.write("\r\x03\x03");
    await sleep(50);

    // Enter raw REPL (Ctrl-A) and wait for the device banner rather than a
    // blind delay. Fall back to a short sleep if the banner never shows.
    await writer.write("\x01");
    const sawBanner = await waitForInCapture(RAW_REPL_BANNER, BANNER_WAIT_MS);
    if (!sawBanner) await sleep(50);

    // Stream the source in 256-byte chunks with a small inter-chunk gap —
    // well under the USB CDC FIFO size and within the Pico's parse rate.
    const chunkSize = 256;
    for (let i = 0; i < code.length; i += chunkSize) {
      await writer.write(code.slice(i, i + chunkSize));
      await sleep(2);
    }

    // Execute: Ctrl+D
    await writer.write("\x04");

    // Completion: resolve as soon as the device prints the caller marker or
    // closes the exec frame with `\x04>`, whichever lands first; the hard
    // cap stops a stuck device hanging the UI.
    if (store.peekCapture) {
      const POLL_MS = 20;
      while (performance.now() - t0 < hardCap) {
        const buf = store.peekCapture();
        if (buf) {
          if (marker && buf.includes(marker)) {
            found = true;
            break;
          }
          if (buf.includes(EXEC_END_MARKER)) {
            found = true;
            break;
          }
        }
        await sleep(POLL_MS);
      }
    } else {
      // No peekable buffer — honour the blind wait budget.
      await sleep(effectiveWait);
    }

    // Exit raw REPL (Ctrl+B), then nudge the friendly prompt to redraw.
    await writer.write("\x02");
    await sleep(20);
    try {
      await writer.write("\r");
    } catch (_e) {
      /* connection may have closed mid-flight */
    }

    const output = ownsCapture
      ? store.stopCaptureAndGet()
      : store.peekCapture
        ? store.peekCapture()
        : "";
    return { found, elapsedMs: performance.now() - t0, output };
  } finally {
    if (ownsCapture && store.isCapturing()) store.stopCaptureAndGet();
  }
}

/**
 * Send raw command to Pico via raw REPL mode.
 * @param {string} code - Python code to execute.
 * @param {number} [waitMs] - Optional hard upper bound on the completion
 *   wait. If omitted, a value is derived from the code length via
 *   computeWaitMs(); execution still returns early as soon as the device
 *   closes the exec frame (`\x04>`).
 */
export async function sendRawCommand(code, waitMs) {
  await rawExec(code, { waitMs });
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
  if (!marker || typeof marker !== "string") {
    throw new Error("sendRawCommandUntilMarker: marker is required");
  }

  // Hide the raw REPL chatter (markers, OK acks) from the user terminal for
  // the duration; restored even if rawExec throws.
  const wasSilent = store.isSilentMode();
  store.setSilentMode(true);
  try {
    return await rawExec(code, { marker, hardCap: maxWaitMs });
  } finally {
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
