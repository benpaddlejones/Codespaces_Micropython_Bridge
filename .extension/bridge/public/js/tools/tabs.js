/**
 * Tab Controller
 *
 * The bridge UI is paginated into three first-class views: REPL, Files,
 * and Plotter. Every element that belongs to a specific tab carries a
 * `data-tab="..."` attribute (toolbars, tab bodies, the input bar). The
 * tab button itself carries `data-tab="..."` plus role=tab semantics.
 *
 * Activating a tab:
 *   1. Hides every `[data-tab]` element whose value !== the active tab.
 *   2. Shows every `[data-tab]` element whose value === the active tab.
 *   3. Updates aria-selected on the tab buttons.
 *   4. Calls a tab-specific hook (e.g. resize the terminal when REPL
 *      becomes visible, enable/disable the plotter when its tab is the
 *      active one, refresh the sync UI on first Files activation).
 *   5. Persists the active tab to localStorage so reloads land back
 *      where the user was.
 */

import { togglePlotter } from "../plotter/controls.js";
import { fitTerminal } from "../terminal/setup.js";
import { refreshSyncStatus } from "./syncStatus.js";

const STORAGE_KEY = "picoBridge.activeTab";
const VALID_TABS = ["repl", "files", "plotter"];

let activeTab = null;
let filesAutoRefreshed = false;

/**
 * Switch to a named tab. No-op if already active or the name is unknown.
 * @param {"repl"|"files"|"plotter"} name
 */
export function setActiveTab(name) {
  if (!VALID_TABS.includes(name)) return;
  if (name === activeTab) return;

  const previous = activeTab;
  activeTab = name;

  // Show / hide every element scoped to a tab.
  document.querySelectorAll("[data-tab]").forEach((el) => {
    // Tab buttons are themselves [data-tab] — handled separately below.
    if (el.classList.contains("tab-btn")) return;
    if (el.dataset.tab === name) {
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  });

  // Update tab buttons. Roving tabindex: only the active tab is in the
  // page Tab order; the others are reached via arrow keys (handled in
  // initTabs).
  document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
    const isActive = btn.dataset.tab === name;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
    btn.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  // Tab-specific side effects.
  applyTabSideEffects(name, previous);

  // Persist for next reload.
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    /* localStorage may be disabled — non-fatal */
  }
}

/**
 * Return the currently active tab name, or null before init().
 */
export function getActiveTab() {
  return activeTab;
}

function applyTabSideEffects(name, previous) {
  // Plotter is a live data sink — only stream while its tab is active.
  if (name === "plotter") {
    togglePlotter(true);
  } else if (previous === "plotter") {
    togglePlotter(false);
  }

  // REPL became visible — re-fit the terminal to the new container size.
  if (name === "repl") {
    // Two-tick delay: one for `hidden` removal to apply, one for layout.
    setTimeout(() => fitTerminal(), 0);
    setTimeout(() => fitTerminal(), 60);
  }

  // First visit to Files tab — kick a sync refresh so the user sees
  // status immediately instead of an empty list.
  if (name === "files" && !filesAutoRefreshed) {
    filesAutoRefreshed = true;
    // Defer so the panel is in the DOM before the refresh queries it.
    setTimeout(() => {
      refreshSyncStatus().catch(() => {
        // refreshSyncStatus already writes any error into the UI.
      });
    }, 50);
  }
}

/**
 * Wire up tab buttons and restore the last active tab from storage.
 * Defaults to "repl".
 */
export function initTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab-btn[data-tab]"));

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  // WAI-ARIA Authoring Practices: arrow keys move focus between tabs in
  // a tablist, Home/End jump to first/last. Activating with Enter/Space
  // is handled by the native button behaviour (which fires "click").
  const tablist = document.querySelector('[role="tablist"]');
  if (tablist) {
    tablist.addEventListener("keydown", (e) => {
      const current = tabs.indexOf(document.activeElement);
      if (current === -1) return;
      let next = -1;
      if (e.key === "ArrowRight") next = (current + 1) % tabs.length;
      else if (e.key === "ArrowLeft")
        next = (current - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next === -1) return;
      e.preventDefault();
      const target = tabs[next];
      setActiveTab(target.dataset.tab);
      target.focus();
    });
  }

  let initial = "repl";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_TABS.includes(stored)) initial = stored;
  } catch {
    /* ignore */
  }

  // Force a state transition even if `initial` matches the default
  // markup — we still need to run side effects (e.g. fitting the
  // terminal once the DOM is laid out).
  activeTab = null;
  setActiveTab(initial);
}
