/**
 * Terminal Setup Module
 * Handles xterm.js terminal initialization and configuration.
 */

import { FitAddon } from "https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/+esm";
import { Terminal } from "https://cdn.jsdelivr.net/npm/xterm@5.3.0/+esm";

// Terminal instance (singleton)
let term = null;
let fitAddon = null;
let resizeObserver = null;
let fitScheduled = false;

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
  // Larger scrollback so long sessions / verbose tracebacks remain visible.
  scrollback: 10000,
  // Most upstream serial data uses \n only; convertEol prevents lines from
  // running together visually without us having to rewrite the byte stream.
  convertEol: true,
  // Shift+wheel = fast scroll, matching VS Code's terminal.
  fastScrollModifier: "shift",
  allowProposedApi: true,
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

  // Attempt the WebGL renderer for smooth handling of large bursts; fall
  // back silently to the DOM renderer if WebGL is unavailable (some
  // Codespaces browsers / remote sessions).
  loadWebglRendererSafely(term);

  scheduleFit();

  // Refit whenever the terminal host or any sibling that competes for
  // vertical space changes size. ResizeObserver catches toolbar wrapping,
  // plotter toggles, DevTools open/close, mobile URL-bar collapse, zoom,
  // etc. — all cases that the lone window.resize listener used to miss.
  resizeObserver = new ResizeObserver(() => scheduleFit());
  resizeObserver.observe(container);
  const refitSelectors = [".input-bar", ".header", ".toolbar", ".tools-bar"];
  for (const sel of refitSelectors) {
    document.querySelectorAll(sel).forEach((el) => resizeObserver.observe(el));
  }

  // Keep window.resize as a fallback for environments where ResizeObserver
  // might miss something (rare, but cheap to keep).
  window.addEventListener("resize", () => scheduleFit());

  return term;
}

/**
 * Best-effort WebGL renderer load. Silently no-ops on failure.
 */
async function loadWebglRendererSafely(t) {
  try {
    const mod =
      await import("https://cdn.jsdelivr.net/npm/xterm-addon-webgl@0.16.0/+esm");
    const addon = new mod.WebglAddon();
    addon.onContextLoss(() => addon.dispose());
    t.loadAddon(addon);
  } catch (err) {
    // DOM renderer is fine, just slower for very large bursts.
    console.warn("WebGL renderer unavailable, using DOM renderer:", err);
  }
}

/**
 * Returns true if the viewport is scrolled to (or past) the bottom of the
 * buffer. Used to preserve "tail -f" behaviour when new data arrives while
 * the user has not scrolled up to inspect history.
 */
export function isAtBottom() {
  if (!term) return true;
  const b = term.buffer.active;
  return b.viewportY >= b.baseY;
}

/**
 * Snap the viewport to the bottom of the buffer.
 */
export function scrollToBottom() {
  if (term) term.scrollToBottom();
}

/**
 * Debounced fit via requestAnimationFrame. Preserves bottom-stick state so
 * a refit triggered mid-stream doesn't visually freeze the user away from
 * the latest output.
 */
export function scheduleFit() {
  if (fitScheduled || !fitAddon) return;
  fitScheduled = true;
  requestAnimationFrame(() => {
    fitScheduled = false;
    const wasAtBottom = isAtBottom();
    try {
      // Use proposeDimensions + manual resize so we can reserve one row of
      // safety margin. Without it, sub-pixel rounding lets fitAddon.fit()
      // squeeze in a partial bottom row that visually clips under the
      // input-bar (the "last line hidden behind the input box" bug).
      const dims = fitAddon.proposeDimensions();
      if (dims && dims.cols > 0 && dims.rows > 1) {
        const safeRows = Math.max(1, dims.rows - 1);
        if (term && (term.cols !== dims.cols || term.rows !== safeRows)) {
          term.resize(dims.cols, safeRows);
        }
      } else {
        // Fallback to default behaviour if proposeDimensions failed.
        fitAddon.fit();
      }
    } catch (err) {
      // fit() can throw if the container is momentarily 0-sized (e.g.
      // during a display:none transition). Safe to ignore — the next
      // ResizeObserver callback will fire when it's visible again.
      console.debug("fitAddon.fit() skipped:", err);
    }
    if (wasAtBottom) scrollToBottom();
  });
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
 * Fit the terminal to its container. Public wrapper that uses the rAF-
 * debounced + bottom-stick path so callers (plotter toggles, etc.) get
 * the same robust behaviour as the ResizeObserver.
 */
export function fitTerminal() {
  scheduleFit();
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
    // Version is injected by the server into <meta name="bridge-version">
    // so the banner always reflects the installed extension version.
    const versionMeta = document.querySelector('meta[name="bridge-version"]');
    const version = versionMeta?.content || "dev";
    term.write(`Raspberry Pi Pico Bridge v${version}\r\n`);
    term.write(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n",
    );
    term.write("Click 'Connect Pico' to connect your Raspberry Pi Pico.\r\n");
    term.write(
      "Use the Pico Tools buttons to manage files on your device.\r\n",
    );
    term.write(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n\r\n",
    );
  }
}
