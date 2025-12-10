/**
 * Terminal Setup Module
 * Handles xterm.js terminal initialization and configuration.
 */

import { Terminal } from "https://cdn.jsdelivr.net/npm/xterm@5.3.0/+esm";
import { FitAddon } from "https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/+esm";

// Terminal instance (singleton)
let term = null;
let fitAddon = null;

/**
 * Terminal configuration
 */
const TERMINAL_CONFIG = {
  cursorBlink: true,
  theme: {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    cursor: "#d4d4d4",
  },
  fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
  fontSize: 14,
};

/**
 * Initialize the terminal
 * @param {HTMLElement} container - DOM element to attach terminal to
 * @returns {Terminal} The terminal instance
 */
export function initTerminal(container) {
  if (term) {
    return term;
  }

  term = new Terminal(TERMINAL_CONFIG);
  fitAddon = new FitAddon();

  term.loadAddon(fitAddon);
  term.open(container);
  fitAddon.fit();

  // Resize on window resize
  window.addEventListener("resize", () => {
    fitAddon.fit();
  });

  return term;
}

/**
 * Get the terminal instance
 */
export function getTerminal() {
  return term;
}

/**
 * Get the fit addon for manual fitting
 */
export function getFitAddon() {
  return fitAddon;
}

/**
 * Fit the terminal to its container
 */
export function fitTerminal() {
  if (fitAddon) {
    fitAddon.fit();
  }
}

/**
 * Clear the terminal
 */
export function clearTerminal() {
  if (term) {
    term.clear();
  }
}

/**
 * Write welcome message to terminal
 */
export function writeWelcomeMessage() {
  if (term) {
    term.write("Raspberry Pi Pico Bridge v2.0\r\n");
    term.write(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n"
    );
    term.write("Click 'Connect Pico' to connect your Raspberry Pi Pico.\r\n");
    term.write(
      "Use the Pico Tools buttons to manage files on your device.\r\n"
    );
    term.write(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n\r\n"
    );
  }
}
