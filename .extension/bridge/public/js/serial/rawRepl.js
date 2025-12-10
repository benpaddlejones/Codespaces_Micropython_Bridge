/**
 * Raw REPL Module
 * Handles MicroPython raw REPL protocol for executing code on Pico.
 */

import * as store from "../state/store.js";
import { sleep } from "./connection.js";

/**
 * Send raw command to Pico via raw REPL mode
 * @param {string} code - Python code to execute
 * @param {number} waitMs - Wait time after execution (default 500ms)
 */
export async function sendRawCommand(code, waitMs = 500) {
  const writer = store.getWriter();
  if (!writer) {
    throw new Error("Not connected to Pico");
  }

  // Single Ctrl+C to interrupt any running code
  await writer.write("\x03");
  await sleep(50);

  // Enter raw REPL mode: Ctrl+A
  await writer.write("\x01");
  await sleep(100);

  // Send the code in chunks to avoid buffer issues
  const chunkSize = 128;
  for (let i = 0; i < code.length; i += chunkSize) {
    const chunk = code.slice(i, i + chunkSize);
    await writer.write(chunk);
    await sleep(5);
  }

  // Execute: Ctrl+D
  await writer.write("\x04");

  // Wait for execution to complete
  await sleep(waitMs);

  // Exit raw REPL: Ctrl+B
  await writer.write("\x02");
  await sleep(50);
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
      `import os\ntry:\n    os.mkdir('${currentPath}')\nexcept:\n    pass`
    );
    await sleep(100);
  }
}
