/**
 * Security Middleware
 *
 * Local-first CSRF / cross-origin protection for the bridge server.
 *
 * The bridge exposes state-changing endpoints (file write, server restart,
 * esptool install, error-log clear) and a Socket.io channel that writes
 * straight to the connected microcontroller. Because the port is reachable
 * from the browser (and forwarded publicly in Codespaces), any other page
 * open in the same browser could otherwise POST to it or open a socket and
 * drive the device.
 *
 * DESIGN — long shelf life, zero staleness:
 * Protection is purely HEADER based, so there is *nothing to expire*. A tab
 * left open for hours or days keeps working as long as it stays same-origin.
 * We never issue a token that can go stale and lock out a legitimate user.
 *
 *   1. `Sec-Fetch-Site` (Fetch Metadata) is the primary check. It is sent by
 *      every Chromium browser — and Chromium is the only browser that
 *      implements the Web Serial API this tool requires — so it is always
 *      present for real users. Cross-site requests are rejected; same-origin
 *      / same-site / direct navigations are allowed.
 *   2. `Origin` vs `Host` is the fallback for non-browser clients (curl, the
 *      extension's own health poller) that omit `Sec-Fetch-Site`. A missing
 *      `Origin` is treated as a trusted same-origin / non-CORS request.
 *
 * An optional `PICO_BRIDGE_ALLOWED_ORIGINS` env var (comma-separated) lets an
 * operator explicitly allow-list extra origins if ever needed.
 */

/**
 * Parse the optional operator-supplied origin allow-list.
 * @returns {Set<string>} lower-cased origins explicitly allowed.
 */
function getAllowedOrigins() {
  const raw = process.env.PICO_BRIDGE_ALLOWED_ORIGINS || "";
  return new Set(
    raw
      .split(",")
      .map((o) => o.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Decide whether a request originates from a cross-site context.
 *
 * @param {object} headers - Incoming request headers (lower-cased keys).
 * @returns {boolean} true if the request should be rejected as cross-site.
 */
function isCrossSite(headers) {
  const allowed = getAllowedOrigins();
  const origin = headers["origin"];

  // Explicit operator allow-list always wins.
  if (origin && allowed.has(String(origin).toLowerCase())) {
    return false;
  }

  // Primary defence: Fetch Metadata (always present in Chromium).
  const secFetchSite = headers["sec-fetch-site"];
  if (secFetchSite) {
    // "same-origin" | "same-site" | "none" (direct nav) are safe.
    return secFetchSite === "cross-site";
  }

  // Fallback for non-browser clients that omit Sec-Fetch-Site.
  if (!origin) {
    // No Origin header => same-origin navigation or non-CORS tool. Allow.
    return false;
  }
  try {
    const originHost = new URL(origin).host;
    const host = headers["x-forwarded-host"] || headers["host"];
    return Boolean(host) && originHost !== host;
  } catch {
    // Unparseable Origin header => treat as hostile.
    return true;
  }
}

/**
 * Apply a small set of defensive response headers (no external dependency).
 *
 * @param {import('http').ServerResponse} res
 */
function applySecurityHeaders(res) {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "SAMEORIGIN");
  res.set("Referrer-Policy", "no-referrer");
  // CSP scoped to the origins the bundled UI actually uses (self + the
  // jsDelivr CDN for Bootstrap/xterm, inline styles for dynamic plotter
  // colours, data:/blob: for canvas exports, and ws/wss for Socket.io).
  if (!process.env.PICO_BRIDGE_DISABLE_CSP) {
    res.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "img-src 'self' data: blob:",
        "font-src 'self' data: https://cdn.jsdelivr.net",
        // Socket.io connects same-origin via io(). On plain localhost that is
        // http/ws; in a GitHub Codespace the page is served through the
        // forwarded *.app.github.dev HTTPS proxy, so the XHR-poll and the
        // websocket upgrade can resolve to proxied https:/wss: URLs that the
        // bare ws:/wss: scheme list doesn't reliably satisfy. Allow https: too.
        // The real abuse boundary is the loopback bind (F04) + Socket.io
        // origin guard (F02), not connect-src.
        "connect-src 'self' https: ws: wss:",
        "frame-ancestors 'self'",
      ].join("; "),
    );
  }
}

/**
 * Express middleware: adds security headers to every response and rejects
 * cross-site state-changing (non-GET/HEAD/OPTIONS) requests.
 *
 * @returns {import('express').RequestHandler}
 */
function createSecurityMiddleware() {
  const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

  return function security(req, res, next) {
    applySecurityHeaders(res);

    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    if (isCrossSite(req.headers)) {
      console.log(
        `[security] Rejected cross-site ${req.method} ${req.path} ` +
          `(origin=${req.headers["origin"] || "?"}, ` +
          `sec-fetch-site=${req.headers["sec-fetch-site"] || "?"})`,
      );
      return res.status(403).json({
        success: false,
        error: "Cross-site request blocked",
      });
    }

    return next();
  };
}

/**
 * Socket.io handshake guard. Rejects connections whose handshake originates
 * from a cross-site context, mirroring the REST origin check so a malicious
 * page cannot open a socket and write to the device.
 *
 * @returns {(socket: import('socket.io').Socket, next: Function) => void}
 */
function createSocketOriginGuard() {
  return function socketOriginGuard(socket, next) {
    try {
      if (isCrossSite(socket.handshake.headers)) {
        console.log(
          `[security] Rejected cross-site socket connection ` +
            `(origin=${socket.handshake.headers.origin || "?"})`,
        );
        return next(new Error("Cross-site connection blocked"));
      }
    } catch (err) {
      // On any unexpected parsing error, fail closed.
      return next(new Error("Origin check failed"));
    }
    return next();
  };
}

module.exports = {
  createSecurityMiddleware,
  createSocketOriginGuard,
  // Exported for unit testing.
  isCrossSite,
};
