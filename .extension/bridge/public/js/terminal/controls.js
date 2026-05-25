/**
 * Terminal Controls Module
 * Owns the floating "Jump to bottom" pill and "Pause output" toggle that
 * overlay the terminal area. Also exposes pause state so the write path in
 * output.js can buffer instead of writing while paused.
 *
 * Design notes:
 * - Pills are injected once into #main-content and positioned absolutely so
 *   they never alter the terminal layout (no refits needed when they
 *   appear/disappear).
 * - "Pause" buffers raw chunks in-memory (capped) — when resumed, the
 *   buffer is flushed via the normal queueWrite path so coalescing and
 *   bottom-stick logic still apply.
 * - "Jump to bottom" appears only when the user has scrolled up from the
 *   bottom of the xterm buffer (i.e. they're reading history).
 */

import { getTerminal, isAtBottom, scrollToBottom } from "./setup.js";

// --- Pause state ----------------------------------------------------------
let paused = false;
const pauseBuffer = []; // array of string chunks
let pauseBufferLen = 0;
// Hard cap on buffered characters while paused. ~2 MB is generous for
// realistic MicroPython print storms but prevents unbounded memory growth
// if the user forgets they paused.
const MAX_PAUSE_BUFFER_CHARS = 2_000_000;
let pauseDroppedChars = 0;

// --- DOM refs (lazy) ------------------------------------------------------
let pauseBtn = null;
let jumpBtn = null;
let pauseCountEl = null;
let flushFn = null; // injected from output.js to flush buffered data on resume

/**
 * Register the buffered-write flush function from output.js. Done via
 * dependency injection to avoid an import cycle.
 */
export function registerPauseFlush(fn) {
  flushFn = fn;
}

export function isPaused() {
  return paused;
}

/**
 * Called from the write path when output is paused. Returns true if the
 * data was buffered (caller should not write to xterm); false if the
 * caller should proceed normally.
 */
export function bufferIfPaused(data) {
  if (!paused) return false;
  if (pauseBufferLen + data.length > MAX_PAUSE_BUFFER_CHARS) {
    // Drop oldest chunks until there's room; keep the most recent output
    // which is what the user is most likely to want when they resume.
    const overflow = pauseBufferLen + data.length - MAX_PAUSE_BUFFER_CHARS;
    let dropped = 0;
    while (dropped < overflow && pauseBuffer.length > 0) {
      const head = pauseBuffer.shift();
      dropped += head.length;
      pauseBufferLen -= head.length;
    }
    pauseDroppedChars += dropped;
  }
  pauseBuffer.push(data);
  pauseBufferLen += data.length;
  updatePauseLabel();
  return true;
}

function updatePauseLabel() {
  if (!pauseCountEl) return;
  if (!paused) {
    pauseCountEl.textContent = "";
    pauseCountEl.style.display = "none";
    return;
  }
  pauseCountEl.style.display = "";
  if (pauseBufferLen === 0) {
    pauseCountEl.textContent = "(0 buffered)";
  } else {
    const kb = (pauseBufferLen / 1024).toFixed(pauseBufferLen < 10240 ? 1 : 0);
    const dropNote = pauseDroppedChars
      ? ` · ${(pauseDroppedChars / 1024).toFixed(0)} KB dropped`
      : "";
    pauseCountEl.textContent = `(${kb} KB buffered${dropNote})`;
  }
}

function setPaused(next) {
  paused = next;
  if (paused) {
    pauseBtn.textContent = "▶ Resume output";
    pauseBtn.classList.add("paused");
    pauseBtn.title =
      "Output is paused. Click to resume and flush buffered data.";
  } else {
    pauseBtn.textContent = "⏸ Pause output";
    pauseBtn.classList.remove("paused");
    pauseBtn.title = "Pause incoming output (useful during print storms)";
    // Flush whatever accumulated while paused. We pass chunks individually
    // so the queueWrite coalescer in output.js can batch them itself.
    if (flushFn) {
      const chunks = pauseBuffer.splice(0, pauseBuffer.length);
      pauseBufferLen = 0;
      for (const c of chunks) flushFn(c);
    }
    pauseDroppedChars = 0;
  }
  updatePauseLabel();
}

/**
 * Initialize the floating controls. Idempotent.
 * @param {HTMLElement} hostContainer - typically #main-content
 */
export function initTerminalControls(hostContainer) {
  if (pauseBtn) return;
  const host = hostContainer || document.getElementById("main-content");
  if (!host) return;

  const bar = document.createElement("div");
  bar.className = "terminal-controls";
  bar.innerHTML = `
    <button type="button" class="term-ctrl-btn pause-btn" title="Pause incoming output (useful during print storms)">
      <span class="term-ctrl-label">⏸ Pause output</span>
      <span class="term-ctrl-count"></span>
    </button>
    <button type="button" class="term-ctrl-btn jump-btn" title="Scroll to bottom" hidden>
      ↓ Jump to bottom
    </button>
  `;
  host.appendChild(bar);

  pauseBtn = bar.querySelector(".pause-btn");
  jumpBtn = bar.querySelector(".jump-btn");
  pauseCountEl = bar.querySelector(".term-ctrl-count");

  pauseBtn.addEventListener("click", () => setPaused(!paused));
  jumpBtn.addEventListener("click", () => {
    scrollToBottom();
    refreshJumpVisibility();
  });

  // Subscribe to xterm scroll events. Use both onScroll (viewport changes)
  // and onLineFeed (new content) — either can change at-bottom state.
  const term = getTerminal();
  if (term) {
    term.onScroll(() => refreshJumpVisibility());
    term.onLineFeed(() => refreshJumpVisibility());
  }
  // Some scroll wheel events on the xterm viewport are intercepted before
  // they reach the parent, so also poll on the wheel handler.
  host.addEventListener("wheel", () => refreshJumpVisibility(), {
    passive: true,
  });

  refreshJumpVisibility();
}

function refreshJumpVisibility() {
  if (!jumpBtn) return;
  const term = getTerminal();
  if (!term) return;
  jumpBtn.hidden = isAtBottom();
}

/**
 * Public hook used by output.js after each flush so the jump pill toggles
 * correctly when new content arrives.
 */
export function notifyTerminalUpdated() {
  refreshJumpVisibility();
}
