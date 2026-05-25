/**
 * Version consistency guard.
 *
 * The canonical version lives in `.extension/package.json`. Every other
 * place that mentions a version (README badges, the lockfile, the
 * CHANGELOG heading) is supposed to track it. Historically those drift
 * — e.g. shipping 2.2.0 with a `Version-2.1.18-green` badge — so this
 * test fails loudly the moment any one of them falls out of sync.
 *
 * To add a new check, append to `CHECKS` below.
 */

import assert from "node:assert/strict";
import { before, test } from "node:test";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_DIR = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(EXTENSION_DIR, "..");

let CANONICAL;

before(() => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(EXTENSION_DIR, "package.json"), "utf8"),
  );
  CANONICAL = pkg.version;
  assert.match(
    CANONICAL,
    /^\d+\.\d+\.\d+$/,
    `canonical version in package.json must be semver, got "${CANONICAL}"`,
  );
});

/**
 * Each check declares:
 *   file:    path of file to load
 *   label:   human-readable description for failure messages
 *   find:    function(text, version) -> { ok, detail }
 *            returns ok=true if the file is consistent with `version`,
 *            otherwise ok=false with a short detail string.
 */
const CHECKS = [
  {
    file: path.join(EXTENSION_DIR, "package.json"),
    label: ".extension/package.json (canonical)",
    find: (text, v) => {
      const pkg = JSON.parse(text);
      return pkg.version === v
        ? { ok: true }
        : { ok: false, detail: `version field = "${pkg.version}"` };
    },
  },
  {
    file: path.join(EXTENSION_DIR, "package-lock.json"),
    label: ".extension/package-lock.json top-level",
    find: (text, v) => {
      const lock = JSON.parse(text);
      return lock.version === v
        ? { ok: true }
        : { ok: false, detail: `top-level version = "${lock.version}"` };
    },
  },
  {
    file: path.join(EXTENSION_DIR, "package-lock.json"),
    label: ".extension/package-lock.json root package entry",
    find: (text, v) => {
      const lock = JSON.parse(text);
      const root = lock.packages && lock.packages[""];
      const found = root && root.version;
      return found === v
        ? { ok: true }
        : { ok: false, detail: `packages[""].version = "${found}"` };
    },
  },
  {
    file: path.join(EXTENSION_DIR, "README.md"),
    label: ".extension/README.md version badge",
    find: (text, v) => {
      // Matches shields.io badge like "Version-2.2.1-green"
      const m = text.match(/Version-(\d+\.\d+\.\d+)-/);
      if (!m) return { ok: false, detail: "no Version-X.Y.Z- badge found" };
      return m[1] === v
        ? { ok: true }
        : { ok: false, detail: `badge shows ${m[1]}` };
    },
  },
  {
    file: path.join(REPO_ROOT, "README.md"),
    label: "root README.md version badge",
    find: (text, v) => {
      const m = text.match(/Version-(\d+\.\d+\.\d+)-/);
      if (!m) return { ok: false, detail: "no Version-X.Y.Z- badge found" };
      return m[1] === v
        ? { ok: true }
        : { ok: false, detail: `badge shows ${m[1]}` };
    },
  },
  {
    file: path.join(EXTENSION_DIR, "CHANGELOG.md"),
    label: ".extension/CHANGELOG.md has heading for current version",
    find: (text, v) => {
      // Look for a heading like "## [2.2.1] - YYYY-MM-DD" (date optional).
      const re = new RegExp(`^##\\s*\\[${v.replace(/\./g, "\\.")}\\]`, "m");
      return re.test(text)
        ? { ok: true }
        : { ok: false, detail: `no "## [${v}]" heading found` };
    },
  },
  {
    file: path.join(EXTENSION_DIR, "CHANGELOG.md"),
    label: ".extension/CHANGELOG.md current version is the top entry",
    find: (text, v) => {
      // The first "## [X.Y.Z]" heading must be the canonical version.
      const m = text.match(/^##\s*\[(\d+\.\d+\.\d+)\]/m);
      if (!m) return { ok: false, detail: "no version heading found at all" };
      return m[1] === v
        ? { ok: true }
        : { ok: false, detail: `top heading is [${m[1]}]` };
    },
  },
];

for (const check of CHECKS) {
  test(`version sync: ${check.label}`, () => {
    if (!fs.existsSync(check.file)) {
      assert.fail(`Expected file does not exist: ${check.file}`);
    }
    const text = fs.readFileSync(check.file, "utf8");
    const { ok, detail } = check.find(text, CANONICAL);
    assert.ok(
      ok,
      `${check.label} is out of sync with package.json (${CANONICAL}): ${detail}\n` +
        `  file: ${path.relative(REPO_ROOT, check.file)}`,
    );
  });
}

test("version sync: no stale shields.io version badges in tracked docs", () => {
  // Belt-and-braces over the targeted README checks above: scan every
  // tracked Markdown file we own for shields.io "Version-X.Y.Z-" badges
  // and fail if any of them disagree with package.json. We restrict the
  // pattern to the shields.io badge form because looser patterns (e.g.
  // "v2.0.0", "version 2.0.0") legitimately appear as historical
  // section headers like "### v2.0.0 New Features" and would false-
  // positive constantly. CHANGELOG.md is excluded — it correctly lists
  // every prior release.
  const docs = [
    path.join(EXTENSION_DIR, "README.md"),
    path.join(REPO_ROOT, "README.md"),
  ];

  const badgeRe = /Version-(\d+\.\d+\.\d+)-/g;

  const offenders = [];
  for (const file of docs) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    badgeRe.lastIndex = 0;
    let m;
    while ((m = badgeRe.exec(text)) !== null) {
      if (m[1] !== CANONICAL) {
        offenders.push(
          `${path.relative(REPO_ROOT, file)}: badge "${m[0]}" (expected ${CANONICAL})`,
        );
      }
    }
  }

  assert.equal(
    offenders.length,
    0,
    `Found ${offenders.length} stale version badge(s):\n  ` +
      offenders.join("\n  "),
  );
});
