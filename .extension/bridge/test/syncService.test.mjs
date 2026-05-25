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
