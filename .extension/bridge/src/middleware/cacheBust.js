/**
 * Cache-Bust Middleware
 *
 * Browsers cache ES module imports aggressively, even with
 * `Cache-Control: no-store`, because the module map keys off the full URL.
 * To guarantee a fresh module graph every time the bridge server starts
 * (extension reload or VS Code window reload), we rewrite local asset URLs
 * to include a `?v=<BUILD_TOKEN>` query string. The token is generated
 * once at server startup, so every fresh process invalidates every URL.
 *
 * We rewrite:
 *   - HTML `<script src="...">`, `<link href="...">`, `<img src="...">`
 *     attributes pointing at local files.
 *   - JS `import ... from "./x.js"` and `import("./x.js")` (and `../`).
 *
 * External URLs (http://, https://, //cdn..., /socket.io/...) and URLs
 * that already carry a query string are left alone.
 *
 * We also inject `<meta name="bridge-version">` and
 * `<meta name="bridge-build">` so the UI can render the real version
 * (instead of a hardcoded `v2.0` string) and surface the build token
 * for support / diagnostics.
 */

const fs = require("fs");
const path = require("path");

function shouldSkip(url) {
  if (!url) {
    return true;
  }
  if (/^(https?:)?\/\//i.test(url)) {
    return true;
  }
  if (url.startsWith("/socket.io/")) {
    return true;
  }
  if (url.startsWith("data:")) {
    return true;
  }
  if (url.startsWith("#")) {
    return true;
  }
  return url.includes("?");
}

function appendVersion(url, token) {
  if (shouldSkip(url)) {
    return url;
  }
  return `${url}?v=${token}`;
}

function rewriteHtml(html, token, version) {
  let out = html;

  // Inject version + build meta tags right after <head ...>, once.
  if (!/<meta\s+name=["']bridge-version["']/i.test(out)) {
    out = out.replace(
      /<head([^>]*)>/i,
      (match, attrs) =>
        `<head${attrs}>\n    <meta name="bridge-version" content="${version}" />` +
        `\n    <meta name="bridge-build" content="${token}" />`,
    );
  }

  // Append ?v=<token> to local src= / href= attributes.
  out = out.replace(
    /\b(src|href)=(["'])([^"']+)\2/gi,
    (match, attr, quote, url) =>
      `${attr}=${quote}${appendVersion(url, token)}${quote}`,
  );

  return out;
}

function rewriteJs(js, token) {
  // Static imports: `from "./x.js"` / `from "../x.js"`
  let out = js.replace(
    /(\bfrom\s*)(["'])(\.{1,2}\/[^"']+\.js)(["'])/g,
    (match, pre, q1, modPath, q2) =>
      `${pre}${q1}${appendVersion(modPath, token)}${q2}`,
  );
  // Dynamic imports: `import("./x.js")`
  out = out.replace(
    /(\bimport\s*\(\s*)(["'])(\.{1,2}\/[^"']+\.js)(["']\s*\))/g,
    (match, pre, q1, modPath, q2) =>
      `${pre}${q1}${appendVersion(modPath, token)}${q2}`,
  );
  return out;
}

function createCacheBustMiddleware({ publicDir, buildToken, version }) {
  const normalizedPublic = path.resolve(publicDir);

  return function cacheBust(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    // Express's req.path already strips the query string.
    const requestPath = req.path === "/" ? "/index.html" : req.path;
    const ext = path.extname(requestPath).toLowerCase();
    if (ext !== ".html" && ext !== ".js") {
      return next();
    }

    // Resolve safely inside publicDir (defence-in-depth against traversal).
    const candidate = path.resolve(
      path.join(normalizedPublic, decodeURIComponent(requestPath)),
    );
    if (
      candidate !== normalizedPublic &&
      !candidate.startsWith(normalizedPublic + path.sep)
    ) {
      return next();
    }

    fs.readFile(candidate, "utf8", (err, content) => {
      if (err) {
        // Fall through to express.static / 404 handler.
        return next();
      }
      const isHtml = ext === ".html";
      const body = isHtml
        ? rewriteHtml(content, buildToken, version)
        : rewriteJs(content, buildToken);

      res.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.type(isHtml ? "html" : "application/javascript");
      res.send(body);
    });
  };
}

module.exports = {
  createCacheBustMiddleware,
  // exported for tests / reuse
  rewriteHtml,
  rewriteJs,
};
