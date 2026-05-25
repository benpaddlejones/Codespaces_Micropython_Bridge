/**
 * Unit tests for the browser-side LCS line differ.
 *
 * Even though diff.js is shipped to the browser as an ES module, it has
 * zero DOM dependencies, so we can load it directly under Node's test
 * runner and exercise the pure functions.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { diffLines, renderDiffHtml } from "../public/js/tools/diff.js";

test("diffLines: identical input emits only ctx ops", () => {
  const ops = diffLines("a\nb\nc", "a\nb\nc");
  assert.equal(ops.length, 3);
  assert.ok(ops.every((o) => o.tag === "ctx"));
  assert.deepEqual(
    ops.map((o) => o.line),
    ["a", "b", "c"],
  );
});

test("diffLines: empty -> content emits adds for every new line", () => {
  // "".split(/\r?\n/) === [""], so the LCS sees one common empty line.
  // We only care that every non-empty input line is reported as add.
  const ops = diffLines("", "a\nb");
  const adds = ops.filter((o) => o.tag === "add").map((o) => o.line);
  assert.deepEqual(adds, ["a", "b"]);
});

test("diffLines: content -> empty emits dels for every removed line", () => {
  const ops = diffLines("a\nb", "");
  const dels = ops.filter((o) => o.tag === "del").map((o) => o.line);
  assert.deepEqual(dels, ["a", "b"]);
});

test("diffLines: single-line replace produces one del + one add", () => {
  const ops = diffLines("a\nb\nc", "a\nX\nc");
  const tags = ops.map((o) => o.tag).join(",");
  // Order may interleave but the multiset must match.
  const counts = ops.reduce(
    (m, o) => ((m[o.tag] = (m[o.tag] || 0) + 1), m),
    {},
  );
  assert.equal(counts.ctx, 2, `expected 2 ctx in ${tags}`);
  assert.equal(counts.del, 1, `expected 1 del in ${tags}`);
  assert.equal(counts.add, 1, `expected 1 add in ${tags}`);

  // The 'b' must be a del, and 'X' must be an add.
  assert.ok(ops.some((o) => o.tag === "del" && o.line === "b"));
  assert.ok(ops.some((o) => o.tag === "add" && o.line === "X"));
});

test("diffLines: handles CRLF line endings", () => {
  const ops = diffLines("a\r\nb\r\nc", "a\nb\nc");
  // All lines should match (split regex strips \r) → pure ctx.
  assert.ok(ops.every((o) => o.tag === "ctx"));
});

test("renderDiffHtml: escapes HTML metacharacters", () => {
  const html = renderDiffHtml([
    { tag: "add", line: "<script>alert('x')</script>" },
    { tag: "del", line: "a & b" },
    { tag: "ctx", line: "plain" },
  ]);
  assert.ok(html.includes("&lt;script&gt;"), "must escape <");
  assert.ok(html.includes("&amp;"), "must escape &");
  assert.ok(!html.includes("<script>"), "must not contain raw script");
});

test("renderDiffHtml: emits one .diff-line per op", () => {
  const ops = [
    { tag: "ctx", line: "a" },
    { tag: "add", line: "b" },
    { tag: "del", line: "c" },
  ];
  const html = renderDiffHtml(ops);
  const matches = html.match(/class="diff-line/g) || [];
  assert.equal(matches.length, 3);
  assert.ok(html.includes("diff-add"));
  assert.ok(html.includes("diff-del"));
  assert.ok(html.includes("diff-ctx"));
});

test("renderDiffHtml: uses +/-/space sign markers", () => {
  const html = renderDiffHtml([
    { tag: "add", line: "x" },
    { tag: "del", line: "y" },
    { tag: "ctx", line: "z" },
  ]);
  assert.ok(html.includes(">+<"));
  assert.ok(html.includes(">-<"));
  assert.ok(html.includes("> <"));
});
