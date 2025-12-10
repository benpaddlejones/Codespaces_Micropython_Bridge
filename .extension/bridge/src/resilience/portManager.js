/**
 * Port Manager
 * Handles port conflicts and ensures the server can always bind to its port.
 */

const net = require("net");
const { exec } = require("child_process");
const util = require("util");

const execAsync = util.promisify(exec);

// Default port
const DEFAULT_PORT = 3000;

/**
 * Check if a port is available
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port, "0.0.0.0");
  });
}

/**
 * Find a process using a specific port
 */
async function findProcessOnPort(port) {
  try {
    // Try lsof first (Linux/Mac)
    const { stdout } = await execAsync(
      `lsof -i :${port} -t 2>/dev/null || true`
    );
    const pids = stdout.trim().split("\n").filter(Boolean);
    return pids.map((pid) => parseInt(pid, 10)).filter((pid) => !isNaN(pid));
  } catch (error) {
    console.log(
      `[portManager] Could not find process on port ${port}:`,
      error.message
    );
    return [];
  }
}

/**
 * Kill process on a specific port
 */
async function killProcessOnPort(port) {
  const pids = await findProcessOnPort(port);

  if (pids.length === 0) {
    console.log(`[portManager] No process found on port ${port}`);
    return true;
  }

  // Don't kill ourselves!
  const ourPid = process.pid;
  const otherPids = pids.filter((pid) => pid !== ourPid);

  if (otherPids.length === 0) {
    console.log(`[portManager] Only our process is using port ${port}`);
    return true;
  }

  console.log(
    `[portManager] Killing processes on port ${port}: ${otherPids.join(", ")}`
  );

  for (const pid of otherPids) {
    try {
      // Send SIGTERM first (graceful)
      process.kill(pid, "SIGTERM");
      console.log(`[portManager] Sent SIGTERM to PID ${pid}`);
    } catch (error) {
      if (error.code === "ESRCH") {
        console.log(`[portManager] PID ${pid} already dead`);
      } else {
        console.error(
          `[portManager] Failed to kill PID ${pid}:`,
          error.message
        );
      }
    }
  }

  // Wait a bit for processes to die
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Check if port is now free
  const stillBlocked = await findProcessOnPort(port);
  const stillOther = stillBlocked.filter((pid) => pid !== ourPid);

  if (stillOther.length > 0) {
    console.log(`[portManager] Processes still on port, sending SIGKILL...`);
    for (const pid of stillOther) {
      try {
        process.kill(pid, "SIGKILL");
      } catch (error) {
        // Ignore
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return true;
}

/**
 * Wait for port to become available with retry
 */
async function waitForPort(port, options = {}) {
  const { maxAttempts = 10, retryDelay = 1000, forceKill = true } = options;

  console.log(`[portManager] Waiting for port ${port} to become available...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const available = await isPortAvailable(port);

    if (available) {
      console.log(`[portManager] Port ${port} is available`);
      return true;
    }

    console.log(
      `[portManager] Port ${port} in use (attempt ${attempt}/${maxAttempts})`
    );

    // On first attempt with forceKill, try to kill the process
    if (attempt === 1 && forceKill) {
      await killProcessOnPort(port);
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  console.error(
    `[portManager] Port ${port} still not available after ${maxAttempts} attempts`
  );
  return false;
}

/**
 * Get an available port, starting from the preferred port
 */
async function getAvailablePort(preferredPort = DEFAULT_PORT, maxOffset = 10) {
  for (let offset = 0; offset <= maxOffset; offset++) {
    const port = preferredPort + offset;
    const available = await isPortAvailable(port);
    if (available) {
      if (offset > 0) {
        console.log(
          `[portManager] Preferred port ${preferredPort} unavailable, using ${port}`
        );
      }
      return port;
    }
  }

  throw new Error(
    `No available ports found in range ${preferredPort}-${
      preferredPort + maxOffset
    }`
  );
}

/**
 * Ensure a specific port is available (will kill conflicting processes)
 */
async function ensurePortAvailable(port, options = {}) {
  const available = await isPortAvailable(port);

  if (available) {
    return true;
  }

  console.log(
    `[portManager] Port ${port} is not available, attempting to free it...`
  );

  if (options.forceKill !== false) {
    await killProcessOnPort(port);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return await isPortAvailable(port);
}

module.exports = {
  isPortAvailable,
  findProcessOnPort,
  killProcessOnPort,
  waitForPort,
  getAvailablePort,
  ensurePortAvailable,
  DEFAULT_PORT,
};
