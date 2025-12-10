/**
 * Pico Control Module
 * Handles device control operations (stop, reset, bootloader).
 */

import * as store from "../state/store.js";
import { termWrite } from "../terminal/output.js";
import {
  sendInterrupt,
  sendSoftReset,
  sendHardReset,
  enterBootloader as rawEnterBootloader,
} from "../serial/rawRepl.js";

/**
 * Stop running code (Ctrl+C) - Returns to REPL
 */
export async function stopCode() {
  if (!store.isConnected()) {
    termWrite("\r\n[Bridge] Please connect to Pico first\r\n");
    return;
  }

  try {
    await sendInterrupt();
    termWrite("\r\n[Bridge] ✓ Stop signal sent\r\n");
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
  }
}

/**
 * Soft reset Pico (Ctrl+D in normal REPL) - Restarts and runs main.py
 */
export async function softReset() {
  if (!store.isConnected()) {
    termWrite("\r\n[Bridge] Please connect to Pico first\r\n");
    return;
  }

  termWrite("\r\n[Bridge] Soft resetting Pico...\r\n");

  try {
    await sendSoftReset();
    termWrite("[Bridge] ✓ Soft reset sent\r\n");
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
  }
}

/**
 * Hard reset - trigger machine.reset() - Full reboot, USB disconnects
 */
export async function hardReset() {
  if (!store.isConnected()) {
    termWrite("\r\n[Bridge] Please connect to Pico first\r\n");
    return;
  }

  termWrite("\r\n[Bridge] Hard resetting Pico...\r\n");

  try {
    await sendHardReset();
    termWrite("[Bridge] Pico is rebooting - USB will disconnect...\r\n");
    termWrite("[Bridge] ✓ Reconnect when ready\r\n");
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
  }
}

/**
 * Bootloader mode - Enter UF2 mode for firmware updates
 */
export async function enterBootloader() {
  if (!store.isConnected()) {
    termWrite("\r\n[Bridge] Please connect to Pico first\r\n");
    return;
  }

  if (
    !confirm(
      "⚠️ This will enter bootloader (UF2) mode for firmware updates.\n\n" +
        "The Pico will appear as a USB drive.\n" +
        "You'll need to reconnect after.\n\n" +
        "Continue?"
    )
  ) {
    termWrite("\r\n[Bridge] Bootloader cancelled\r\n");
    return;
  }

  termWrite("\r\n[Bridge] Entering bootloader mode...\r\n");

  try {
    await rawEnterBootloader();
    termWrite("[Bridge] ✓ Pico should appear as USB drive (RPI-RP2)\r\n");
    termWrite("[Bridge] Drag .uf2 firmware file to update\r\n");
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
  }
}
