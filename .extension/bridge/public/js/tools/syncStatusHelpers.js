/**
 * Pure helper functions extracted from syncStatus.js so they can be
 * unit-tested under Node's test runner without a DOM.
 *
 * Nothing in this file touches the DOM, the network, or window/global
 * state. If you add anything here, keep it that way — otherwise the
 * Node tests will fail to import the module.
 */

// MicroPython bare-metal ports (rp2, stm32, esp32 without RTC sync)
// use an epoch of 2000-01-01 instead of 1970-01-01. We detect that by
// checking for an implausibly old date and shift forward by 30 years.
export const EPOCH_2000_OFFSET = 946684800; // seconds between 1970-01-01 and 2000-01-01

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

export function formatBytes(n) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

/**
 * Render an mtime (seconds since unix epoch, OR seconds since the
 * MicroPython 2000-epoch if the value is implausibly low) as a small
 * relative-time `<span>`. Returns "" for null / non-finite / <=0 input.
 *
 * @param {number|null|undefined} seconds
 * @param {number} [nowMs] - override "now" for deterministic tests
 * @returns {string} HTML string, possibly empty
 */
export function formatMtime(seconds, nowMs = Date.now()) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "";
  let s = seconds;
  if (s < EPOCH_2000_OFFSET) s += EPOCH_2000_OFFSET;
  const d = new Date(s * 1000);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = nowMs - d.getTime();
  const absDiff = Math.abs(diffMs);
  const MIN = 60_000;
  const HOUR = 3_600_000;
  const DAY = 86_400_000;
  let rel;
  if (absDiff < MIN) rel = "just now";
  else if (absDiff < HOUR) rel = `${Math.round(absDiff / MIN)}m ago`;
  else if (absDiff < DAY) rel = `${Math.round(absDiff / HOUR)}h ago`;
  else if (absDiff < 7 * DAY) rel = `${Math.round(absDiff / DAY)}d ago`;
  else rel = d.toLocaleDateString();
  const abs = d.toLocaleString();
  return `<span class="sync-mtime" title="${escapeAttr(abs)}">🕒 ${escapeHtml(rel)}</span>`;
}

/**
 * Pico-style dirname. Always uses "/" separators (no path.sep), and
 * collapses to "/" for root paths.
 */
export function dirnamePico(p) {
  if (!p || p === "/") return "/";
  const idx = p.lastIndexOf("/");
  if (idx <= 0) return "/";
  return p.slice(0, idx);
}

/**
 * Pico-style basename. Returns the substring after the last "/".
 */
export function basenamePico(p) {
  if (!p) return "";
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(idx + 1) : p;
}

/**
 * Whether a folder (dir) is "missing locally" — i.e. exists on the
 * device but has no workspace files at or beneath it. Used by the
 * device-files side panel to decide whether to show the per-folder
 * "← Pull folder" button on the group header.
 *
 * @param {string} dir - Pico-style directory path, e.g. "/lib" or "/"
 * @param {Array<{path:string, status:string, workspace?:object|null}>} rows
 * @returns {boolean}
 */
export function isFolderMissingLocally(dir, rows) {
  const prefix = dir === "/" ? "/" : dir + "/";
  const anyWorkspaceUnder = rows.some(
    (r) => r.workspace && (r.path === dir || r.path.startsWith(prefix)),
  );
  if (anyWorkspaceUnder) return false;
  const hasOrphanUnder = rows.some(
    (r) =>
      r.status === "orphan" && (r.path === dir || r.path.startsWith(prefix)),
  );
  return hasOrphanUnder;
}
