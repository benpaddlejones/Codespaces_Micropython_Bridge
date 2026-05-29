/**
 * Unit tests for the cross-site (CSRF) detection in the security middleware.
 * These exercise the pure `isCrossSite` helper with the same header shapes
 * the REST middleware and Socket.io handshake guard receive.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, test } from "node:test";

const require = createRequire(import.meta.url);
const { isCrossSite } = require("../src/middleware/security");

afterEach(() => {
  delete process.env.PICO_BRIDGE_ALLOWED_ORIGINS;
});

test("Sec-Fetch-Site: same-origin is allowed", () => {
  assert.equal(isCrossSite({ "sec-fetch-site": "same-origin" }), false);
});

test("Sec-Fetch-Site: same-site is allowed", () => {
  assert.equal(isCrossSite({ "sec-fetch-site": "same-site" }), false);
});

test("Sec-Fetch-Site: none (direct navigation) is allowed", () => {
  assert.equal(isCrossSite({ "sec-fetch-site": "none" }), false);
});

test("Sec-Fetch-Site: cross-site is rejected", () => {
  assert.equal(isCrossSite({ "sec-fetch-site": "cross-site" }), true);
});

test("No Origin and no Sec-Fetch-Site is treated as same-origin (allowed)", () => {
  assert.equal(isCrossSite({}), false);
});

test("Fallback: matching Origin host and Host is allowed", () => {
  assert.equal(
    isCrossSite({ origin: "http://localhost:3000", host: "localhost:3000" }),
    false,
  );
});

test("Fallback: mismatched Origin host is rejected", () => {
  assert.equal(
    isCrossSite({ origin: "http://evil.example", host: "localhost:3000" }),
    true,
  );
});

test("Fallback: unparseable Origin is rejected", () => {
  assert.equal(
    isCrossSite({ origin: "not a url", host: "localhost:3000" }),
    true,
  );
});

test("Fallback honours x-forwarded-host", () => {
  assert.equal(
    isCrossSite({
      origin: "https://app-3000.example.dev",
      host: "localhost:3000",
      "x-forwarded-host": "app-3000.example.dev",
    }),
    false,
  );
});

test("Operator allow-list overrides a cross-site verdict", () => {
  process.env.PICO_BRIDGE_ALLOWED_ORIGINS = "https://trusted.example";
  assert.equal(
    isCrossSite({
      "sec-fetch-site": "cross-site",
      origin: "https://trusted.example",
    }),
    false,
  );
});
