/**
 * Unit tests for the workspace-side sync service. We point
 * PICO_BRIDGE_WORKSPACE_ROOT at a temp fixture so the walker has a
 * predictable file tree to enumerate, hash, and exclude.
 */

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

let tmpRoot;
let syncService;
let fileService;

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

before(() => {
  // Build a fixture tree under a temp dir.
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pico-bridge-sync-"));

  // Project marker so findProjectRoot resolves to tmpRoot.
  fs.writeFileSync(path.join(tmpRoot, ".micropico"), "");

  fs.writeFileSync(path.join(tmpRoot, "main.py"), "print('hi')\n");
  fs.writeFileSync(path.join(tmpRoot, "boot.py"), "import gc\n");
  fs.writeFileSync(path.join(tmpRoot, "data.txt"), "hello\n");

  // Should be EXCLUDED — wrong extension.
  fs.writeFileSync(path.join(tmpRoot, "binary.bin"), "x");

  // Should be EXCLUDED — hidden file.
  fs.writeFileSync(path.join(tmpRoot, ".secret.py"), "secret");

  // Nested deployable file.
  fs.mkdirSync(path.join(tmpRoot, "lib"));
  fs.writeFileSync(path.join(tmpRoot, "lib", "helper.py"), "def f(): pass\n");

  // Excluded directory.
  fs.mkdirSync(path.join(tmpRoot, "node_modules"));
  fs.writeFileSync(
    path.join(tmpRoot, "node_modules", "junk.py"),
    "should be ignored",
  );

  // Excluded directory ".git".
  fs.mkdirSync(path.join(tmpRoot, ".git"));
  fs.writeFileSync(path.join(tmpRoot, ".git", "config.py"), "ignored");

  // Excluded "release" directory.
  fs.mkdirSync(path.join(tmpRoot, "release"));
  fs.writeFileSync(path.join(tmpRoot, "release", "out.py"), "ignored");

  // Now wire config to the fixture and require fresh modules.
  process.env.PICO_BRIDGE_WORKSPACE_ROOT = tmpRoot;
  // Bust the require cache so config recomputes paths.
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}bridge${path.sep}`)) delete require.cache[key];
  }
  syncService = require("../src/services/syncService");
  fileService = require("../src/services/fileService");
});

after(() => {
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

test("listWorkspaceFilesWithHash detects the .micropico project root", () => {
  const result = syncService.listWorkspaceFilesWithHash();
  assert.equal(result.projectDetected, true);
  assert.ok(Array.isArray(result.files));
});

test("listWorkspaceFilesWithHash returns only deployable files", () => {
  const { files } = syncService.listWorkspaceFilesWithHash();
  const paths = files.map((f) => f.path).sort();
  assert.deepEqual(paths, [
    "/boot.py",
    "/data.txt",
    "/lib/helper.py",
    "/main.py",
  ]);
});

test("listWorkspaceFilesWithHash excludes node_modules, .git, release, hidden", () => {
  const { files } = syncService.listWorkspaceFilesWithHash();
  const paths = files.map((f) => f.path);
  assert.ok(!paths.some((p) => p.includes("node_modules")));
  assert.ok(!paths.some((p) => p.includes(".git")));
  assert.ok(!paths.some((p) => p.includes("release")));
  assert.ok(!paths.some((p) => p.includes(".secret")));
  assert.ok(!paths.some((p) => p.endsWith(".bin")));
});

test("listWorkspaceFilesWithHash returns correct SHA-256 per file", () => {
  const { files } = syncService.listWorkspaceFilesWithHash();
  const main = files.find((f) => f.path === "/main.py");
  assert.ok(main);
  assert.equal(main.sha256, sha256(Buffer.from("print('hi')\n")));
  assert.equal(main.size, "print('hi')\n".length);
});

test("readWorkspaceFile returns content for a valid path", () => {
  const result = syncService.readWorkspaceFile("/main.py");
  assert.ok(result);
  assert.equal(result.content, "print('hi')\n");
  assert.equal(result.size, "print('hi')\n".length);
});

test("readWorkspaceFile resolves nested paths", () => {
  const result = syncService.readWorkspaceFile("/lib/helper.py");
  assert.ok(result);
  assert.equal(result.content, "def f(): pass\n");
});

test("readWorkspaceFile rejects path traversal", () => {
  assert.equal(syncService.readWorkspaceFile("/../../etc/passwd"), null);
  assert.equal(syncService.readWorkspaceFile("/../escape.py"), null);
});

test("readWorkspaceFile returns null for missing files", () => {
  assert.equal(syncService.readWorkspaceFile("/does-not-exist.py"), null);
});

test("readWorkspaceFile returns null for invalid input", () => {
  assert.equal(syncService.readWorkspaceFile(null), null);
  assert.equal(syncService.readWorkspaceFile(123), null);
  assert.equal(syncService.readWorkspaceFile(""), null);
});

test("writeWorkspaceFile writes content within project root", () => {
  const result = syncService.writeWorkspaceFile(
    "/pulled.py",
    "# from device\n",
  );
  assert.ok(result);
  const onDisk = fs.readFileSync(path.join(tmpRoot, "pulled.py"), "utf8");
  assert.equal(onDisk, "# from device\n");
});

test("writeWorkspaceFile creates intermediate directories", () => {
  const result = syncService.writeWorkspaceFile(
    "/new_dir/nested/file.py",
    "x = 1\n",
  );
  assert.ok(result);
  assert.equal(
    fs.readFileSync(path.join(tmpRoot, "new_dir/nested/file.py"), "utf8"),
    "x = 1\n",
  );
});

test("writeWorkspaceFile rejects path traversal", () => {
  assert.equal(syncService.writeWorkspaceFile("/../escape.py", "x"), null);
  // Sanity: nothing was written outside the fixture.
  assert.equal(fs.existsSync(path.join(tmpRoot, "..", "escape.py")), false);
});

test("writeWorkspaceFile rejects invalid input", () => {
  assert.equal(syncService.writeWorkspaceFile(null, "x"), null);
  assert.equal(syncService.writeWorkspaceFile("/x.py", null), null);
  assert.equal(syncService.writeWorkspaceFile("/x.py", 123), null);
});

// ---------------------------------------------------------------------------
// New coverage (Stage 1): hasLib, mtime, findProjectRoot, getLibFiles
// ---------------------------------------------------------------------------

test("listWorkspaceFilesWithHash includes mtime (seconds since unix epoch)", () => {
  const { files } = syncService.listWorkspaceFilesWithHash();
  const main = files.find((f) => f.path === "/main.py");
  assert.ok(main, "main.py should be present");
  assert.equal(typeof main.mtime, "number");
  assert.ok(Number.isInteger(main.mtime), "mtime should be an integer");
  // Sanity range: between year 2010 and year 2100 (unix seconds).
  assert.ok(main.mtime > 1262304000 && main.mtime < 4102444800);
});

test("listWorkspaceFilesWithHash hasLib=false when no lib/ folder exists", () => {
  // The fixture has no lib/ directly under root — it created lib/ for
  // a nested deployable file, so this asserts the opposite: hasLib
  // should be TRUE here. We add a counter-test below using a separate
  // fixture without lib/.
  const result = syncService.listWorkspaceFilesWithHash();
  assert.equal(typeof result.hasLib, "boolean");
  assert.equal(result.hasLib, true);
});

test("listWorkspaceFilesWithHash hasLib=false on a project without lib/", () => {
  // Build a parallel fixture with NO lib/ folder, swap the workspace
  // root, bust the cache, re-require, and assert.
  const altRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pico-bridge-noLib-"));
  fs.writeFileSync(path.join(altRoot, ".micropico"), "");
  fs.writeFileSync(path.join(altRoot, "main.py"), "print('x')\n");

  process.env.PICO_BRIDGE_WORKSPACE_ROOT = altRoot;
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}bridge${path.sep}`)) delete require.cache[key];
  }
  const altSync = require("../src/services/syncService");
  try {
    const result = altSync.listWorkspaceFilesWithHash();
    assert.equal(result.hasLib, false);
    assert.equal(result.projectDetected, true);
  } finally {
    // Restore original workspace root for any tests that may run later.
    process.env.PICO_BRIDGE_WORKSPACE_ROOT = tmpRoot;
    for (const key of Object.keys(require.cache)) {
      if (key.includes(`${path.sep}bridge${path.sep}`))
        delete require.cache[key];
    }
    syncService = require("../src/services/syncService");
    fileService = require("../src/services/fileService");
    fs.rmSync(altRoot, { recursive: true, force: true });
  }
});

test("findProjectRoot detects the .micropico marker at workspace root", () => {
  const root = fileService.findProjectRoot();
  assert.ok(root, "should detect a project root");
  assert.equal(fs.realpathSync(root), fs.realpathSync(tmpRoot));
});

test("findProjectRoot returns null when no marker and allowFallback=false", () => {
  // Build a fixture with NO .micropico anywhere.
  const altRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pico-bridge-noMark-"));
  fs.writeFileSync(path.join(altRoot, "main.py"), "print('x')\n");
  process.env.PICO_BRIDGE_WORKSPACE_ROOT = altRoot;
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}bridge${path.sep}`)) delete require.cache[key];
  }
  const altFs = require("../src/services/fileService");
  try {
    assert.equal(altFs.findProjectRoot(), null);
    assert.equal(altFs.isProjectDetected(), false);
  } finally {
    process.env.PICO_BRIDGE_WORKSPACE_ROOT = tmpRoot;
    for (const key of Object.keys(require.cache)) {
      if (key.includes(`${path.sep}bridge${path.sep}`))
        delete require.cache[key];
    }
    syncService = require("../src/services/syncService");
    fileService = require("../src/services/fileService");
    fs.rmSync(altRoot, { recursive: true, force: true });
  }
});

test("findProjectRoot falls back to the workspace root when allowFallback=true", () => {
  const altRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pico-bridge-fall-"));
  fs.writeFileSync(path.join(altRoot, "main.py"), "print('x')\n");
  process.env.PICO_BRIDGE_WORKSPACE_ROOT = altRoot;
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}bridge${path.sep}`)) delete require.cache[key];
  }
  const altFs = require("../src/services/fileService");
  try {
    const root = altFs.findProjectRoot({ allowFallback: true });
    assert.ok(root, "should fall back to a real path");
    assert.equal(fs.realpathSync(root), fs.realpathSync(altRoot));
  } finally {
    process.env.PICO_BRIDGE_WORKSPACE_ROOT = tmpRoot;
    for (const key of Object.keys(require.cache)) {
      if (key.includes(`${path.sep}bridge${path.sep}`))
        delete require.cache[key];
    }
    syncService = require("../src/services/syncService");
    fileService = require("../src/services/fileService");
    fs.rmSync(altRoot, { recursive: true, force: true });
  }
});

test("getLibFiles returns the contents of the lib/ folder when present", () => {
  const result = fileService.getLibFiles();
  assert.ok(Array.isArray(result), "lib/ exists in fixture so we get an array");
  const paths = result.map((f) => f.path).sort();
  assert.deepEqual(paths, ["/lib/helper.py"]);
  assert.equal(result[0].content, "def f(): pass\n");
});

test("getLibFiles returns null when there is no lib/ folder", () => {
  const altRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pico-bridge-noLib2-"));
  fs.writeFileSync(path.join(altRoot, ".micropico"), "");
  fs.writeFileSync(path.join(altRoot, "main.py"), "print('x')\n");
  process.env.PICO_BRIDGE_WORKSPACE_ROOT = altRoot;
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}bridge${path.sep}`)) delete require.cache[key];
  }
  const altFs = require("../src/services/fileService");
  try {
    assert.equal(altFs.getLibFiles(), null);
  } finally {
    process.env.PICO_BRIDGE_WORKSPACE_ROOT = tmpRoot;
    for (const key of Object.keys(require.cache)) {
      if (key.includes(`${path.sep}bridge${path.sep}`))
        delete require.cache[key];
    }
    syncService = require("../src/services/syncService");
    fileService = require("../src/services/fileService");
    fs.rmSync(altRoot, { recursive: true, force: true });
  }
});

test("getProjectFiles returns files + directories when project detected", () => {
  const result = fileService.getProjectFiles();
  assert.ok(result);
  assert.ok(Array.isArray(result.files));
  assert.ok(Array.isArray(result.directories));
  // main.py should be in there with content populated.
  const main = result.files.find((f) => f.path && f.path.endsWith("main.py"));
  assert.ok(main, "main.py expected in project files");
  assert.equal(typeof main.content, "string");
});
