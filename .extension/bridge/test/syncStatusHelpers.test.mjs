/**
 * Unit tests for the pure helpers extracted from syncStatus.js.
 * These are dependency-free (no DOM, no fetch) so they run under
 * Node's built-in test runner directly.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EPOCH_2000_OFFSET,
  basenamePico,
  dirnamePico,
  escapeAttr,
  escapeHtml,
  formatBytes,
  formatMtime,
  isFolderMissingLocally,
} from "../public/js/tools/syncStatusHelpers.js";

// ---------------------------------------------------------------------------
// escapeHtml / escapeAttr
// ---------------------------------------------------------------------------

test("escapeHtml: escapes &, <, > and leaves quotes alone", () => {
  assert.equal(
    escapeHtml(`<script>"a" & 'b'</script>`),
    `&lt;script&gt;"a" &amp; 'b'&lt;/script&gt;`,
  );
});

test("escapeAttr: also escapes double quotes", () => {
  assert.equal(escapeAttr(`a "b" <c>`), `a &quot;b&quot; &lt;c&gt;`);
});

test("escapeHtml: coerces non-strings", () => {
  assert.equal(escapeHtml(42), "42");
  assert.equal(escapeHtml(null), "null");
});

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------

test("formatBytes: handles null / undefined / numbers", () => {
  assert.equal(formatBytes(null), "—");
  assert.equal(formatBytes(undefined), "—");
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1024), "1.0 KB");
  assert.equal(formatBytes(2048), "2.0 KB");
});

// ---------------------------------------------------------------------------
// dirnamePico / basenamePico
// ---------------------------------------------------------------------------

test("dirnamePico: root / empty / no-slash collapse to '/'", () => {
  assert.equal(dirnamePico(""), "/");
  assert.equal(dirnamePico(null), "/");
  assert.equal(dirnamePico(undefined), "/");
  assert.equal(dirnamePico("/"), "/");
});

test("dirnamePico: top-level file -> '/'", () => {
  assert.equal(dirnamePico("/main.py"), "/");
});

test("dirnamePico: nested paths return the parent", () => {
  assert.equal(dirnamePico("/lib/foo.py"), "/lib");
  assert.equal(dirnamePico("/lib/launcher/handler.py"), "/lib/launcher");
});

test("basenamePico: returns the trailing segment", () => {
  assert.equal(basenamePico(""), "");
  assert.equal(basenamePico("/"), "");
  assert.equal(basenamePico("/main.py"), "main.py");
  assert.equal(basenamePico("/lib/launcher/handler.py"), "handler.py");
  assert.equal(basenamePico("naked.py"), "naked.py");
});

// ---------------------------------------------------------------------------
// formatMtime
// ---------------------------------------------------------------------------

test("formatMtime: rejects null / negative / NaN", () => {
  assert.equal(formatMtime(null), "");
  assert.equal(formatMtime(undefined), "");
  assert.equal(formatMtime(0), "");
  assert.equal(formatMtime(-5), "");
  assert.equal(formatMtime(NaN), "");
});

test("formatMtime: unix-epoch values render a relative time span", () => {
  const now = new Date("2030-06-15T12:00:00Z").getTime();
  const tenMinutesAgo = Math.floor(now / 1000) - 600;
  const html = formatMtime(tenMinutesAgo, now);
  assert.match(html, /class="sync-mtime"/);
  assert.match(html, /10m ago/);
});

test("formatMtime: 2000-epoch heuristic shifts MicroPython timestamps", () => {
  // The heuristic only fires for values that would otherwise land
  // before year 2000 if interpreted as unix-epoch. That means it
  // catches devices in roughly their first ~30 years of life. We pick
  // a "now" of 2026 so a 2000-epoch "5 minutes ago" is comfortably
  // below EPOCH_2000_OFFSET and triggers the shift.
  const now = new Date("2026-06-15T12:00:00Z").getTime();
  const unixFiveMinAgo = Math.floor(now / 1000) - 300;
  const microMtime = unixFiveMinAgo - EPOCH_2000_OFFSET;
  assert.ok(
    microMtime > 0 && microMtime < EPOCH_2000_OFFSET,
    `test setup: micro mtime ${microMtime} should be in (0, ${EPOCH_2000_OFFSET})`,
  );
  const html = formatMtime(microMtime, now);
  assert.match(html, /5m ago/);
});

test("formatMtime: 'just now' bucket for sub-minute deltas", () => {
  const now = new Date("2030-06-15T12:00:00Z").getTime();
  const html = formatMtime(Math.floor(now / 1000) - 10, now);
  assert.match(html, /just now/);
});

test("formatMtime: hour / day / week buckets", () => {
  const now = new Date("2030-06-15T12:00:00Z").getTime();
  const s = (deltaSec) => formatMtime(Math.floor(now / 1000) - deltaSec, now);
  assert.match(s(2 * 3600), /2h ago/);
  assert.match(s(3 * 86400), /3d ago/);
  // > 7 days falls through to toLocaleDateString — just assert the span
  // wraps something, not the locale-specific date text.
  assert.match(s(30 * 86400), /<span class="sync-mtime"/);
});

test("formatMtime: escapes the absolute-time tooltip", () => {
  // The tooltip is produced by toLocaleString() so it can't contain
  // attack characters in practice, but escapeAttr should still run.
  const now = new Date("2030-06-15T12:00:00Z").getTime();
  const html = formatMtime(Math.floor(now / 1000), now);
  // Must not contain a raw unescaped " inside the title= attribute body
  // (other than the attribute delimiters themselves).
  const titleMatch = html.match(/title="([^"]*)"/);
  assert.ok(titleMatch, "must include a title attribute");
  assert.ok(
    !titleMatch[1].includes('"'),
    "title attribute body must not contain raw double-quotes",
  );
});

// ---------------------------------------------------------------------------
// isFolderMissingLocally
// ---------------------------------------------------------------------------

const orphan = (p) => ({ path: p, status: "orphan", workspace: null });
const synced = (p) => ({ path: p, status: "synced", workspace: { path: p } });
const modified = (p) => ({
  path: p,
  status: "modified",
  workspace: { path: p },
});
const notDeployed = (p) => ({
  path: p,
  status: "not-deployed",
  workspace: { path: p },
});

test("isFolderMissingLocally: true when every row under dir is orphan", () => {
  const rows = [orphan("/lib/foo.py"), orphan("/lib/bar.py")];
  assert.equal(isFolderMissingLocally("/lib", rows), true);
});

test("isFolderMissingLocally: false when any row has a workspace side", () => {
  const rows = [orphan("/lib/foo.py"), synced("/lib/bar.py")];
  assert.equal(isFolderMissingLocally("/lib", rows), false);
});

test("isFolderMissingLocally: false when folder has no orphans at all", () => {
  const rows = [synced("/lib/foo.py"), modified("/lib/bar.py")];
  assert.equal(isFolderMissingLocally("/lib", rows), false);
});

test("isFolderMissingLocally: nested orphans count toward parent dir", () => {
  const rows = [orphan("/lib/launcher/handler.py"), orphan("/lib/foo.py")];
  assert.equal(isFolderMissingLocally("/lib", rows), true);
  assert.equal(isFolderMissingLocally("/lib/launcher", rows), true);
});

test("isFolderMissingLocally: a synced sibling outside dir does NOT count", () => {
  const rows = [orphan("/lib/foo.py"), synced("/main.py")];
  assert.equal(isFolderMissingLocally("/lib", rows), true);
});

test("isFolderMissingLocally: a workspace file deeper down rescues the dir", () => {
  const rows = [
    orphan("/lib/launcher/handler.py"),
    notDeployed("/lib/launcher/files.py"),
  ];
  // /lib/launcher has a workspace-side row (notDeployed), so it's not
  // missing — even though there's also an orphan in there.
  assert.equal(isFolderMissingLocally("/lib/launcher", rows), false);
});

test("isFolderMissingLocally: root '/' treated correctly", () => {
  // Pure orphans at root → root is missing (degenerate but consistent).
  assert.equal(isFolderMissingLocally("/", [orphan("/stale.py")]), true);
  // Any workspace row anywhere is "under /", so root is not missing.
  assert.equal(
    isFolderMissingLocally("/", [orphan("/stale.py"), synced("/main.py")]),
    false,
  );
});

test("isFolderMissingLocally: empty rows -> false", () => {
  assert.equal(isFolderMissingLocally("/lib", []), false);
});
