/**
 * Serial Connection Module
 * Handles Web Serial API connection to Pi Pico.
 */

import { getSocket } from "../socket/index.js";
import * as store from "../state/store.js";
import { setStatus, termWrite } from "../terminal/output.js";
import {
  feedDetectionData,
  setDetectionUsbInfo,
  startDetection,
} from "../tools/deviceDetect.js";
import { updateToolButtons } from "../ui/status.js";

// Guards against re-entrant/duplicate cleanup when both the read loop and the
// output pipe report the device being lost at (roughly) the same time.
let cleaningUp = false;

/**
 * Determine whether an error represents an expected loss of the serial device
 * (unplugged, reset, or port closed) rather than a genuine fault.
 * @param {unknown} err
 * @returns {boolean}
 */
function isDeviceLostError(err) {
  if (!err) return false;
  const name = err.name || "";
  const message = err.message || "";
  return (
    name === "NetworkError" ||
    name === "BreakError" ||
    /device has been lost|unknown system error|the device has been closed/i.test(
      message,
    )
  );
}

/**
 * Connect to Pico via Web Serial API
 * @param {number} baudRate - Baud rate for serial connection
 */
export async function connect(baudRate = 115200) {
  if (!navigator.serial) {
    alert(
      "Web Serial API not supported in this browser. Please use Chrome, Edge, or Opera.",
    );
    return;
  }

  // Step 1: Request a port. Cancelling the browser's port picker throws
  // NotFoundError/NotAllowedError — that is a normal user action, not a fault,
  // so we surface a friendly message instead of a red error state.
  let port;
  try {
    port = await navigator.serial.requestPort({});
  } catch (err) {
    if (
      err &&
      (err.name === "NotFoundError" || err.name === "NotAllowedError")
    ) {
      setStatus("Disconnected", "disconnected");
      termWrite(
        "\r\n[Bridge] Connection cancelled — no serial port selected.\r\n",
      );
      return;
    }
    console.error("Port selection error:", err);
    setStatus("Error: " + (err?.message || "Unknown error"), "error");
    termWrite("\r\n[Error] " + (err?.message || "Unknown error") + "\r\n");
    return;
  }

  // Step 2: Open the port and wire up the read/write streams.
  try {
    const usbInfo = typeof port.getInfo === "function" ? port.getInfo() : null;

    await port.open({ baudRate });

    store.setSerialPort(port);
    setStatus("Connected", "connected");
    updateToolButtons(true);

    termWrite(`\r\n[Bridge] Serial Port Opened at ${baudRate} baud\r\n`);
    termWrite(
      "[Bridge] Detecting device… (probing MicroPython/CircuitPython banner)\r\n",
    );

    // Start reading
    store.setKeepReading(true);
    startReadLoop(port);

    // Get writer for sending data. The pipeTo() promise rejects when the device
    // is unplugged; without a .catch() that becomes an uncaught rejection, so we
    // route it through the shared device-lost handler.
    const textEncoder = new TextEncoderStream();
    textEncoder.readable.pipeTo(port.writable).catch((err) => {
      if (!isDeviceLostError(err)) {
        console.error("Serial write stream error:", err);
      }
      onDeviceLost(err);
    });
    const writer = textEncoder.writable.getWriter();
    store.setSerialWriter(writer);

    // Send initialization sequence
    await sleep(200);
    await writer.write("\x03"); // Ctrl+C
    await sleep(100);
    await writer.write("\x03"); // Second Ctrl+C
    await sleep(100);
    await writer.write("\x02"); // Ctrl+B for normal REPL mode

    // Notify server
    const socket = getSocket();
    if (socket) {
      socket.emit("connected", { baud: baudRate });
    }

    // Start device detection
    setDetectionUsbInfo(usbInfo);
    startDetection();
  } catch (err) {
    console.error("Connection error:", err);
    setStatus("Error: " + (err?.message || "Unknown error"), "error");
    termWrite("\r\n[Error] " + (err?.message || "Unknown error") + "\r\n");
    // Leave no half-open port behind if opening/initialising failed.
    await resetConnectionState({ silent: true });
  }
}

/**
 * Handle an unexpected loss of the serial device (unplug/reset) reported by the
 * read loop or the output pipe. Idempotent: only the first caller performs the
 * cleanup, subsequent calls are ignored while a disconnect is already underway.
 * @param {unknown} err
 */
function onDeviceLost(err) {
  // If we are no longer meant to be reading, a normal disconnect is already in
  // progress (or finished) and streams are expected to error — ignore.
  if (!store.getState().serial.keepReading) return;

  const reason = isDeviceLostError(err)
    ? "Device connection lost — please reconnect."
    : "Serial connection closed unexpectedly — please reconnect.";
  void resetConnectionState({ reason });
}

/**
 * Disconnect from Pico (user-initiated).
 */
export async function disconnect() {
  await resetConnectionState();
}

/**
 * Tear down the serial connection and reset all related state/UI.
 *
 * This is the single cleanup path used by user-initiated disconnects, failed
 * connection attempts, and unexpected device loss. Every teardown step is
 * individually guarded so that a stream/reader/port that is already released or
 * errored cannot abort the rest of the cleanup (previously this left the app in
 * a half-connected state that broke the next reconnect).
 *
 * @param {{ silent?: boolean, reason?: string }} [options]
 */
async function resetConnectionState({ silent = false, reason = "" } = {}) {
  if (cleaningUp) return;
  cleaningUp = true;

  try {
    store.setKeepReading(false);
    setDetectionUsbInfo(null);

    // Cancel the reader. It may already be released if the read loop exited on
    // a device-lost error, so cancellation failing here is expected.
    const reader = store.getReader();
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        /* reader already released or stream errored */
      }
      store.setSerialReader(null);
    }

    // Close the writer. Closing can reject if the underlying device is gone.
    const writer = store.getWriter();
    if (writer) {
      try {
        await writer.close();
      } catch {
        /* stream may already be errored */
      }
      store.setSerialWriter(null);
    }

    // Close the port itself.
    const port = store.getPort();
    if (port) {
      try {
        await port.close();
      } catch {
        /* port may already be gone */
      }
      store.setSerialPort(null);
    }

    setStatus("Disconnected", "disconnected");
    updateToolButtons(false);

    if (reason) {
      termWrite(`\r\n[Bridge] ${reason}\r\n`);
    } else if (!silent) {
      termWrite("\r\n[Bridge] Disconnected\r\n");
    }

    // Clear device info
    store.clearDeviceInfo();

    const socket = getSocket();
    if (socket) {
      socket.emit("disconnected");
    }
  } finally {
    cleaningUp = false;
  }
}

/**
 * Start reading loop from serial port
 */
async function startReadLoop(port) {
  const textDecoder = new TextDecoderStream();
  // The read pipe rejects when the device is unplugged; catch it so it does not
  // become an uncaught promise rejection. The read loop below also observes the
  // failure via reader.read(), and onDeviceLost() is idempotent.
  port.readable.pipeTo(textDecoder.writable).catch((err) => {
    if (!isDeviceLostError(err)) {
      console.error("Serial read stream error:", err);
    }
    onDeviceLost(err);
  });
  const reader = textDecoder.readable.getReader();
  store.setSerialReader(reader);

  const socket = getSocket();

  try {
    while (store.getState().serial.keepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        // Feed data to device detection only until the device has been
        // identified. Otherwise every subsequent REPL prompt (e.g. during
        // file uploads) would re-trigger the "Detected:" announcement and
        // spam the terminal.
        if (!store.getDeviceInfo()) {
          feedDetectionData(value);
        }

        // Capture before the silent-mode check so verification works even
        // when the caller wants to hide raw REPL chatter from the user.
        store.appendCapture(value);

        if (!store.isSilentMode()) {
          termWrite(value);
        }
        if (socket) {
          socket.emit("serial-data", value);
        }
      }
    }
  } catch (error) {
    if (store.getState().serial.keepReading) {
      if (isDeviceLostError(error)) {
        // Expected on unplug/reset — reset state cleanly instead of logging a
        // scary error. onDeviceLost() handles the user-facing message.
        onDeviceLost(error);
      } else {
        console.error("Read error:", error);
        termWrite("\r\n[Error] Read error: " + error.message + "\r\n");
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}

/**
 * Send data to Pico
 * @param {string} data - Data to send
 */
export async function sendData(data) {
  const writer = store.getWriter();
  if (writer) {
    try {
      await writer.write(data);
    } catch (err) {
      console.error("Write error:", err);
      termWrite("\r\n[Error] Write error: " + err.message + "\r\n");
    }
  }
}

/**
 * Change baud rate (reconnect with new rate)
 * @param {number} newBaud - New baud rate
 */
export async function changeBaudRate(newBaud) {
  const port = store.getPort();
  if (!port) return;

  termWrite(`\r\n[Bridge] Changing baud rate to ${newBaud}...\r\n`);

  // Need to disconnect and reconnect
  const savedPort = port;
  await disconnect();

  try {
    store.setSerialPort(savedPort);
    await savedPort.open({ baudRate: newBaud });

    setStatus("Connected", "connected");
    updateToolButtons(true);

    store.setKeepReading(true);
    startReadLoop(savedPort);

    const textEncoder = new TextEncoderStream();
    textEncoder.readable.pipeTo(savedPort.writable);
    const writer = textEncoder.writable.getWriter();
    store.setSerialWriter(writer);

    termWrite(`[Bridge] Baud rate changed to ${newBaud}\r\n`);
  } catch (err) {
    console.error("Failed to change baud rate:", err);
    termWrite(`[Error] Failed to change baud rate: ${err.message}\r\n`);
    setStatus("Disconnected", "disconnected");
  }
}

/**
 * Helper: Sleep for ms
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
