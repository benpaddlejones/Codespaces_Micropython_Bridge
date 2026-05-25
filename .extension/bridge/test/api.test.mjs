/**
 * Integration tests for the workspace sync REST API. We mount the real
 * files router onto a fresh Express app pointed at a temp fixture
 * project so we exercise the same code paths the browser hits.
 */

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

let tmpRoot;
let server;
let baseUrl;

function jsonRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + urlPath);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { Accept: "application/json" },
    };
    let payload;
    if (body !== undefined) {
      payload = JSON.stringify(body);
      opts.headers["Content-Type"] = "application/json";
      opts.headers["Content-Length"] = Buffer.byteLength(payload);
    }
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          /* leave as null */
        }
        resolve({ status: res.statusCode, body: parsed, raw: data });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

before(async () => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pico-bridge-api-"));
  fs.writeFileSync(path.join(tmpRoot, ".micropico"), "");
  fs.writeFileSync(path.join(tmpRoot, "main.py"), "print('api')\n");
  fs.writeFileSync(path.join(tmpRoot, "config.json"), '{"x":1}\n');

  process.env.PICO_BRIDGE_WORKSPACE_ROOT = tmpRoot;
  // Bust cached bridge modules so config picks up the new root.
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}bridge${path.sep}`)) delete require.cache[key];
  }

  const express = require("express");
  const filesRouter = require("../src/api/files");

  const app = express();
  app.use("/api", filesRouter);

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

test("GET /api/workspace/sync-status lists deployable files with hashes", async () => {
  const res = await jsonRequest("GET", "/api/workspace/sync-status");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.projectDetected, true);
  const paths = res.body.files.map((f) => f.path).sort();
  assert.deepEqual(paths, ["/config.json", "/main.py"]);
  for (const f of res.body.files) {
    assert.match(f.sha256, /^[a-f0-9]{64}$/);
    assert.equal(typeof f.size, "number");
  }
});

test("GET /api/workspace/file returns content for a valid path", async () => {
  const res = await jsonRequest(
    "GET",
    "/api/workspace/file?path=" + encodeURIComponent("/main.py"),
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.content, "print('api')\n");
});

test("GET /api/workspace/file 400 when path missing", async () => {
  const res = await jsonRequest("GET", "/api/workspace/file");
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test("GET /api/workspace/file 404 for missing file", async () => {
  const res = await jsonRequest(
    "GET",
    "/api/workspace/file?path=" + encodeURIComponent("/nope.py"),
  );
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test("GET /api/workspace/file rejects path traversal (404)", async () => {
  const res = await jsonRequest(
    "GET",
    "/api/workspace/file?path=" + encodeURIComponent("/../../etc/passwd"),
  );
  // syncService returns null on traversal, route maps that to 404.
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test("POST /api/workspace/file writes content within project root", async () => {
  const res = await jsonRequest("POST", "/api/workspace/file", {
    path: "/pulled.py",
    content: "# pulled from device\n",
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const onDisk = fs.readFileSync(path.join(tmpRoot, "pulled.py"), "utf8");
  assert.equal(onDisk, "# pulled from device\n");
});

test("POST /api/workspace/file 400 on missing body fields", async () => {
  const res = await jsonRequest("POST", "/api/workspace/file", {
    path: "/x.py",
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test("POST /api/workspace/file rejects path traversal", async () => {
  const res = await jsonRequest("POST", "/api/workspace/file", {
    path: "/../escape.py",
    content: "evil",
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(
    fs.existsSync(path.join(tmpRoot, "..", "escape.py")),
    false,
    "must not have written outside project root",
  );
});
