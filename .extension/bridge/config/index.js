/**
 * Centralized configuration for the Pi Pico Bridge server.
 * All hardcoded values are extracted here for easy maintenance.
 */

const path = require("path");

// Resolve paths relative to bridge directory
const BRIDGE_ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = process.env.PICO_BRIDGE_WORKSPACE_ROOT
  ? path.resolve(process.env.PICO_BRIDGE_WORKSPACE_ROOT)
  : path.resolve(BRIDGE_ROOT, "..", "..");

module.exports = {
  // Server settings
  server: {
    port: process.env.PORT || 3000,
    // Bind to loopback by default. VS Code / Codespaces port forwarding
    // connects over localhost, so this is both sufficient and safer than
    // exposing the bridge on every interface. Override with PICO_BRIDGE_HOST
    // only when a non-forwarded setup genuinely needs it.
    host: process.env.PICO_BRIDGE_HOST || "127.0.0.1",
  },

  // PTY bridge settings
  pty: {
    linkPath: process.env.PTY_LINK_PATH || "/tmp/picoUSB",
    baudRate: 115200,
    socatTimeout: 5000,
  },

  // Path settings
  paths: {
    bridgeRoot: BRIDGE_ROOT,
    workspaceRoot: WORKSPACE_ROOT,
    projectDir: path.join(WORKSPACE_ROOT, "project"),
    publicDir: path.join(BRIDGE_ROOT, "public"),
  },

  // File watcher settings
  fileWatcher: {
    debounceMs: 500,
    // Watch all the file types we sync to the device so edits to
    // configs, data files, and compiled modules also trigger a refresh.
    extensions: [
      ".py",
      ".mpy",
      ".json",
      ".txt",
      ".csv",
      ".md",
      ".conf",
      ".cfg",
      ".ini",
      ".toml",
      ".html",
      ".css",
      ".js",
    ],
    excludeFolders: ["examples"],
    excludeHidden: true,
  },

  // Static file serving (development mode - no caching)
  staticOptions: {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
    },
  },

  // Socat configuration
  socat: {
    command: "socat",
    getArgs: (linkPath) => [
      "-d",
      "-d",
      // mode=600: owner-only access to the PTY/symlink so other local users
      // on a shared host cannot read or write the device serial stream.
      `pty,raw,echo=0,link=${linkPath},mode=600`,
      "pty,raw,echo=0,mode=600",
    ],
  },
};
