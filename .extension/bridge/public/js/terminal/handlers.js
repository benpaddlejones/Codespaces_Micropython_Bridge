/**
 * Terminal Keyboard Handlers
 * Handles keyboard input for terminal and global shortcuts.
 */

import * as store from "../state/store.js";
import { getTerminal } from "./setup.js";

/**
 * Setup terminal keyboard handlers
 */
export function setupKeyboardHandlers() {
  const term = getTerminal();
  if (!term) return;

  // Terminal data input (direct typing)
  term.onData((data) => {
    const writer = store.getWriter();
    if (writer) {
      writer.write(data);
    }
  });

  // Capture Ctrl+C, Ctrl+B, Ctrl+D before browser intercepts them
  term.attachCustomKeyEventHandler((event) => {
    if (
      event.type === "keydown" &&
      event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      const writer = store.getWriter();
      const key = event.key.toLowerCase();

      if (key === "c") {
        // Ctrl+C - send interrupt
        if (writer) {
          console.log("Sending Ctrl+C interrupt");
          writer.write("\x03");
          return false; // Prevent default and stop propagation
        }
      }
      if (key === "b") {
        // Ctrl+B - exit raw REPL
        if (writer) {
          console.log("Sending Ctrl+B");
          writer.write("\x02");
          return false;
        }
      }
      if (key === "d") {
        // Ctrl+D - soft reset / execute raw REPL
        if (writer) {
          console.log("Sending Ctrl+D");
          writer.write("\x04");
          return false;
        }
      }
      if (key === "a") {
        // Ctrl+A - enter raw REPL
        if (writer) {
          console.log("Sending Ctrl+A");
          writer.write("\x01");
          return false;
        }
      }
    }
    return true; // Let other keys pass through
  });

  // Setup global keyboard handler
  setupGlobalKeyboardHandler();
}

/**
 * Setup global keyboard handler as fallback when terminal doesn't have focus
 */
function setupGlobalKeyboardHandler() {
  document.addEventListener("keydown", (event) => {
    const writer = store.getWriter();

    // Only if Pico is connected and Ctrl is pressed
    if (!writer || !event.ctrlKey || event.shiftKey || event.altKey) return;

    // Check if focus is on an input element - if so, don't intercept
    if (
      document.activeElement.tagName === "INPUT" ||
      document.activeElement.tagName === "TEXTAREA"
    ) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "c") {
      event.preventDefault();
      console.log("Global Ctrl+C - sending interrupt");
      writer.write("\x03");
    } else if (key === "b") {
      event.preventDefault();
      console.log("Global Ctrl+B");
      writer.write("\x02");
    } else if (key === "d") {
      event.preventDefault();
      console.log("Global Ctrl+D");
      writer.write("\x04");
    }
  });
}
