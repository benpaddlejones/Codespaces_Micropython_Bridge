/**
 * Modal Focus Trap
 *
 * WAI-ARIA dialog pattern: while a modal is open the user's keyboard
 * focus must not escape it. Tab and Shift+Tab wrap around the modal's
 * focusable descendants; ESC closes the modal; focus is restored to
 * the element that opened the modal when it closes.
 *
 * Usage:
 *   trapFocus(modalEl, () => hideMyModal());
 *   // ...later, when you close the modal:
 *   releaseFocus(modalEl);
 *
 * The trap is keyed by the modal element so multiple modals can each
 * track their own previously-focused element.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// modal element -> { handler, previouslyFocused, onEscape }
const active = new WeakMap();

function visible(el) {
  if (el.hidden) return false;
  const cs = getComputedStyle(el);
  return cs.display !== "none" && cs.visibility !== "hidden";
}

function getFocusable(modal) {
  return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(visible);
}

/**
 * Activate a focus trap on `modal`. Moves focus to the first focusable
 * descendant (or to `modal` itself if none), wires Tab/Shift+Tab/ESC
 * key handling, and remembers the previously-focused element so it
 * can be restored on release.
 *
 * @param {HTMLElement} modal       The modal root element.
 * @param {Function} [onEscape]     Optional callback to run on ESC.
 */
export function trapFocus(modal, onEscape) {
  if (!modal || active.has(modal)) return;

  const previouslyFocused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  const focusables = getFocusable(modal);
  const initial = focusables[0] || modal;
  if (!modal.hasAttribute("tabindex")) {
    modal.setAttribute("tabindex", "-1");
  }
  initial.focus();

  function handler(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (typeof onEscape === "function") onEscape();
      return;
    }
    if (e.key !== "Tab") return;
    const list = getFocusable(modal);
    if (list.length === 0) {
      e.preventDefault();
      modal.focus();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const current = document.activeElement;
    if (e.shiftKey) {
      if (current === first || !modal.contains(current)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (current === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  modal.addEventListener("keydown", handler);
  active.set(modal, { handler, previouslyFocused });
}

/**
 * Tear down a focus trap previously installed by trapFocus(). Restores
 * focus to whatever was focused before the modal opened.
 */
export function releaseFocus(modal) {
  if (!modal) return;
  const state = active.get(modal);
  if (!state) return;
  modal.removeEventListener("keydown", state.handler);
  active.delete(modal);
  if (
    state.previouslyFocused &&
    typeof state.previouslyFocused.focus === "function"
  ) {
    state.previouslyFocused.focus();
  }
}
