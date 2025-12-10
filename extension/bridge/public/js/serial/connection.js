/**
 * Serial Connection Module
 * Handles Web Serial API connection to Pi Pico.
 */

import * as store from "../state/store.js";
import { termWrite, setStatus } from "../terminal/output.js";
import { updateToolButtons } from "../ui/status.js";
import { getSocket } from "../socket/index.js";
import { startDetection, feedDetectionData } from "../tools/deviceDetect.js";

/**
 * Connect to Pico via Web Serial API
 * @param {number} baudRate - Baud rate for serial connection
 */
export async function connect(baudRate = 115200) {
  if (!navigator.serial) {
    alert(
      "Web Serial API not supported in this browser. Please use Chrome, Edge, or Opera."
    );
    return;
  }

  try {
    // Request the port
    const port = await navigator.serial.requestPort({});

    // Open the port
    await port.open({ baudRate });

    store.setSerialPort(port);
    setStatus("Connected", "connected");
    updateToolButtons(true);

    termWrite(`\r\n[Bridge] Serial Port Opened at ${baudRate} baud\r\n`);

    // Start reading
    store.setKeepReading(true);
    startReadLoop(port);

    // Get writer for sending data
    const textEncoder = new TextEncoderStream();
    textEncoder.readable.pipeTo(port.writable);
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
    startDetection();
  } catch (err) {
    console.error("Connection error:", err);
    setStatus("Error: " + err.message, "error");
    termWrite("\r\n[Error] " + err.message + "\r\n");
  }
}

/**
 * Disconnect from Pico
 */
export async function disconnect() {
  store.setKeepReading(false);

  try {
    const reader = store.getReader();
    if (reader) {
      await reader.cancel();
      store.setSerialReader(null);
    }

    const writer = store.getWriter();
    if (writer) {
      await writer.close();
      store.setSerialWriter(null);
    }

    const port = store.getPort();
    if (port) {
      await port.close();
      store.setSerialPort(null);
    }
  } catch (err) {
    console.error("Disconnect error:", err);
  }

  setStatus("Disconnected", "disconnected");
  updateToolButtons(false);
  termWrite("\r\n[Bridge] Disconnected\r\n");

  // Clear device info
  store.clearDeviceInfo();

  const socket = getSocket();
  if (socket) {
    socket.emit("disconnected");
  }
}

/**
 * Start reading loop from serial port
 */
async function startReadLoop(port) {
  const textDecoder = new TextDecoderStream();
  port.readable.pipeTo(textDecoder.writable);
  const reader = textDecoder.readable.getReader();
  store.setSerialReader(reader);

  const socket = getSocket();

  try {
    while (store.getState().serial.keepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        // Feed data to device detection
        feedDetectionData(value);

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
      console.error("Read error:", error);
      termWrite("\r\n[Error] Read error: " + error.message + "\r\n");
    }
  } finally {
    reader.releaseLock();
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
