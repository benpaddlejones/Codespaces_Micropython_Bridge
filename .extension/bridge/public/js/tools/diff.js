/**
 * Tiny line-level diff renderer (LCS-based).
 *
 * Returns a sequence of {tag, line} objects suitable for rendering as
 * a unified-style diff:
 *   tag: "ctx"  unchanged line
 *   tag: "del"  line present in `a` only
 *   tag: "add"  line present in `b` only
 *
 * Algorithm: longest-common-subsequence on lines. We build the LCS
 * table dynamically; for typical Pico source files (< a few hundred
 * lines) the O(N*M) table is fine and avoids pulling in a diff
 * dependency just for this feature.
 */

export function diffLines(a, b) {
  const aLines = (a || "").split(/\r?\n/);
  const bLines = (b || "").split(/\r?\n/);

  const n = aLines.length;
  const m = bLines.length;

  // LCS length table.
  const table = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (aLines[i] === bLines[j]) {
        table[i][j] = table[i + 1][j + 1] + 1;
      } else {
        table[i][j] = Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
  }

  // Walk the table to emit ops.
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      ops.push({ tag: "ctx", line: aLines[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ tag: "del", line: aLines[i] });
      i++;
    } else {
      ops.push({ tag: "add", line: bLines[j] });
      j++;
    }
  }
  while (i < n) ops.push({ tag: "del", line: aLines[i++] });
  while (j < m) ops.push({ tag: "add", line: bLines[j++] });

  return ops;
}

/**
 * Render a diff op list as an HTML string. Caller is responsible for
 * inserting into a trusted container; lines are HTML-escaped.
 */
export function renderDiffHtml(ops) {
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return ops
    .map((op) => {
      const sign = op.tag === "add" ? "+" : op.tag === "del" ? "-" : " ";
      return `<div class="diff-line diff-${op.tag}"><span class="diff-sign">${sign}</span><span class="diff-text">${esc(op.line)}</span></div>`;
    })
    .join("");
}
