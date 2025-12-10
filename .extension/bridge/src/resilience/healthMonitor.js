/**
 * Health Monitor
 * Continuously monitors server health and triggers self-healing when needed.
 */

const config = require("../../config");

// Health check state
let healthCheckInterval = null;
let lastHealthCheck = null;
let healthHistory = [];
let isRunning = false;

// Health check configuration
const HEALTH_CHECK_INTERVAL = 10000; // 10 seconds
const HEALTH_HISTORY_MAX = 100;
const MEMORY_WARNING_MB = 256;
const MEMORY_CRITICAL_MB = 512;

// Healing callbacks
let healingCallbacks = {
  onMemoryWarning: null,
  onMemoryCritical: null,
  onPtyFailure: null,
  onSocketFailure: null,
  onGenericFailure: null,
};

/**
 * Get current health metrics
 */
function getHealthMetrics() {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    pid: process.pid,
    nodeVersion: process.version,
  };
}

/**
 * Perform a health check and trigger healing if needed
 */
function performHealthCheck(context = {}) {
  const metrics = getHealthMetrics();
  const issues = [];
  const actions = [];

  // Check memory usage
  if (metrics.memory.heapUsed > MEMORY_CRITICAL_MB) {
    issues.push(
      `CRITICAL: Memory usage ${metrics.memory.heapUsed}MB exceeds ${MEMORY_CRITICAL_MB}MB`
    );
    actions.push("FORCE_GC");

    if (healingCallbacks.onMemoryCritical) {
      try {
        healingCallbacks.onMemoryCritical(metrics);
      } catch (e) {
        console.error(
          "[healthMonitor] Memory critical callback error:",
          e.message
        );
      }
    }
  } else if (metrics.memory.heapUsed > MEMORY_WARNING_MB) {
    issues.push(
      `WARNING: Memory usage ${metrics.memory.heapUsed}MB exceeds ${MEMORY_WARNING_MB}MB`
    );
    actions.push("SUGGEST_GC");

    if (healingCallbacks.onMemoryWarning) {
      try {
        healingCallbacks.onMemoryWarning(metrics);
      } catch (e) {
        console.error(
          "[healthMonitor] Memory warning callback error:",
          e.message
        );
      }
    }
  }

  // Check PTY status if provided
  if (context.ptyStatus) {
    if (!context.ptyStatus.ptyReady && context.ptyStatus.shouldBeReady) {
      issues.push("WARNING: PTY bridge is not ready but should be");
      actions.push("RESTART_PTY");

      if (healingCallbacks.onPtyFailure) {
        try {
          healingCallbacks.onPtyFailure(context.ptyStatus);
        } catch (e) {
          console.error(
            "[healthMonitor] PTY failure callback error:",
            e.message
          );
        }
      }
    }
  }

  // Perform healing actions
  for (const action of actions) {
    performHealingAction(action, metrics);
  }

  const result = {
    ...metrics,
    healthy: issues.length === 0,
    issues,
    actions,
  };

  // Store in history
  healthHistory.push(result);
  if (healthHistory.length > HEALTH_HISTORY_MAX) {
    healthHistory = healthHistory.slice(-HEALTH_HISTORY_MAX);
  }

  lastHealthCheck = result;
  return result;
}

/**
 * Perform a specific healing action
 */
function performHealingAction(action, metrics) {
  console.log(`[healthMonitor] Performing healing action: ${action}`);

  switch (action) {
    case "FORCE_GC":
    case "SUGGEST_GC":
      // Force garbage collection if available
      if (global.gc) {
        console.log("[healthMonitor] Running garbage collection...");
        try {
          global.gc();
          console.log("[healthMonitor] Garbage collection completed");
        } catch (e) {
          console.error("[healthMonitor] GC failed:", e.message);
        }
      } else {
        console.log(
          "[healthMonitor] GC not exposed. Start with --expose-gc for manual GC"
        );
      }
      break;

    case "RESTART_PTY":
      // Trigger PTY restart through callback
      if (healingCallbacks.onPtyFailure) {
        console.log("[healthMonitor] Triggering PTY restart...");
      }
      break;

    default:
      console.log(`[healthMonitor] Unknown action: ${action}`);
  }
}

/**
 * Start the health monitor
 */
function start(options = {}) {
  if (isRunning) {
    console.log("[healthMonitor] Already running");
    return;
  }

  const interval = options.interval || HEALTH_CHECK_INTERVAL;

  console.log(
    `[healthMonitor] Starting health monitoring (every ${interval}ms)`
  );

  // Initial check
  performHealthCheck(options.context || {});

  // Start periodic checks
  healthCheckInterval = setInterval(() => {
    try {
      const contextFn = options.getContext || (() => ({}));
      performHealthCheck(contextFn());
    } catch (error) {
      console.error("[healthMonitor] Health check error:", error.message);
    }
  }, interval);

  // Prevent interval from keeping process alive
  healthCheckInterval.unref();

  isRunning = true;
}

/**
 * Stop the health monitor
 */
function stop() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  isRunning = false;
  console.log("[healthMonitor] Stopped");
}

/**
 * Register healing callbacks
 */
function onHeal(eventType, callback) {
  if (healingCallbacks.hasOwnProperty(eventType)) {
    healingCallbacks[eventType] = callback;
  } else {
    console.warn(`[healthMonitor] Unknown event type: ${eventType}`);
  }
}

/**
 * Get health history
 */
function getHistory(count = 20) {
  return healthHistory.slice(-count);
}

/**
 * Get last health check result
 */
function getLastCheck() {
  return lastHealthCheck;
}

/**
 * Check if server is healthy
 */
function isHealthy() {
  if (!lastHealthCheck) return true; // Assume healthy if no check yet
  return lastHealthCheck.healthy;
}

module.exports = {
  start,
  stop,
  performHealthCheck,
  getHealthMetrics,
  getHistory,
  getLastCheck,
  isHealthy,
  onHeal,
};
