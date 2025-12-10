/**
 * Global Error Handler
 * Catches all unhandled errors and exceptions to prevent crashes.
 * Implements comprehensive error recovery strategies.
 */

const fs = require("fs");
const path = require("path");

// Error log file for debugging (keep last 1000 errors)
const ERROR_LOG_MAX = 1000;
let errorLog = [];
let isInitialized = false;

/**
 * Logs an error to the internal buffer and console
 */
function logError(type, error, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    message: error?.message || String(error),
    stack: error?.stack,
    context,
    recovered: true,
  };

  errorLog.push(entry);

  // Keep only last N errors
  if (errorLog.length > ERROR_LOG_MAX) {
    errorLog = errorLog.slice(-ERROR_LOG_MAX);
  }

  console.error(
    `[resilience] ${type}: ${entry.message}`,
    context.silent ? "" : entry.stack || ""
  );

  return entry;
}

/**
 * Get recent errors for diagnostics
 */
function getRecentErrors(count = 50) {
  return errorLog.slice(-count);
}

/**
 * Clear error log
 */
function clearErrors() {
  errorLog = [];
}

/**
 * Safe wrapper for async functions - never throws
 */
function safeAsync(fn, fallback = null, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError("ASYNC_ERROR", error, { ...context, args: args.length });
      return typeof fallback === "function" ? fallback(error) : fallback;
    }
  };
}

/**
 * Safe wrapper for sync functions - never throws
 */
function safeSync(fn, fallback = null, context = {}) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      logError("SYNC_ERROR", error, { ...context, args: args.length });
      return typeof fallback === "function" ? fallback(error) : fallback;
    }
  };
}

/**
 * Wraps an Express route handler with error protection
 */
function safeRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      logError("ROUTE_ERROR", error, {
        method: req.method,
        url: req.url,
        silent: true,
      });

      // Always send a response to prevent hanging
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal server error",
          message: "The server encountered an error but is still running.",
          recovered: true,
        });
      }
    }
  };
}

/**
 * Wraps a Socket.io event handler with error protection
 */
function safeSocketHandler(handler, eventName = "unknown") {
  return (...args) => {
    try {
      const result = handler(...args);
      if (result && typeof result.catch === "function") {
        result.catch((error) => {
          logError("SOCKET_ASYNC_ERROR", error, { event: eventName });
        });
      }
    } catch (error) {
      logError("SOCKET_ERROR", error, { event: eventName });
    }
  };
}

/**
 * Initialize global error handlers
 */
function initialize(options = {}) {
  if (isInitialized) {
    console.log("[resilience] Error handlers already initialized");
    return;
  }

  const { exitOnFatal = false, logToFile = false, onError = null } = options;

  // Handle uncaught exceptions - DO NOT EXIT
  process.on("uncaughtException", (error, origin) => {
    const entry = logError("UNCAUGHT_EXCEPTION", error, { origin });

    console.error(
      "[resilience] ⚠️  Uncaught exception caught - server continues running"
    );

    if (onError) {
      try {
        onError(entry);
      } catch (e) {
        // Ignore callback errors
      }
    }

    // Only exit if explicitly configured (not recommended for high availability)
    if (exitOnFatal) {
      console.error("[resilience] Fatal error mode - exiting");
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections - DO NOT EXIT
  process.on("unhandledRejection", (reason, promise) => {
    const entry = logError("UNHANDLED_REJECTION", reason, {
      promise: String(promise),
    });

    console.error(
      "[resilience] ⚠️  Unhandled rejection caught - server continues running"
    );

    if (onError) {
      try {
        onError(entry);
      } catch (e) {
        // Ignore callback errors
      }
    }
  });

  // Handle warnings (don't exit, just log)
  process.on("warning", (warning) => {
    logError("WARNING", warning, { silent: true });
  });

  // Prevent SIGPIPE from crashing (broken pipe errors)
  process.on("SIGPIPE", () => {
    logError("SIGPIPE", new Error("Broken pipe - connection closed by peer"), {
      silent: true,
    });
  });

  isInitialized = true;
  console.log("[resilience] Global error handlers initialized");
  console.log("[resilience] Server will NOT crash on errors");
}

/**
 * Express error middleware - catches all Express errors
 */
function expressErrorMiddleware(err, req, res, next) {
  logError("EXPRESS_ERROR", err, {
    method: req.method,
    url: req.url,
    body: req.body,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    recovered: true,
    status: "Server is still running",
  });
}

/**
 * Create a circuit breaker for external operations
 */
function createCircuitBreaker(options = {}) {
  const { maxFailures = 5, resetTimeout = 30000, name = "circuit" } = options;

  let failures = 0;
  let lastFailure = null;
  let state = "CLOSED"; // CLOSED = normal, OPEN = blocking, HALF_OPEN = testing

  return {
    async execute(fn) {
      // Check if circuit should reset
      if (
        state === "OPEN" &&
        lastFailure &&
        Date.now() - lastFailure > resetTimeout
      ) {
        state = "HALF_OPEN";
        console.log(
          `[resilience] Circuit breaker '${name}' entering half-open state`
        );
      }

      // If circuit is open, fail fast
      if (state === "OPEN") {
        throw new Error(
          `Circuit breaker '${name}' is OPEN - operation blocked`
        );
      }

      try {
        const result = await fn();

        // Success - reset circuit
        if (state === "HALF_OPEN") {
          console.log(
            `[resilience] Circuit breaker '${name}' recovered - closing`
          );
        }
        failures = 0;
        state = "CLOSED";

        return result;
      } catch (error) {
        failures++;
        lastFailure = Date.now();

        if (failures >= maxFailures) {
          state = "OPEN";
          console.log(
            `[resilience] Circuit breaker '${name}' OPENED after ${failures} failures`
          );
        }

        throw error;
      }
    },

    getState() {
      return { state, failures, maxFailures, lastFailure };
    },

    reset() {
      failures = 0;
      state = "CLOSED";
      lastFailure = null;
    },
  };
}

module.exports = {
  initialize,
  logError,
  getRecentErrors,
  clearErrors,
  safeAsync,
  safeSync,
  safeRoute,
  safeSocketHandler,
  expressErrorMiddleware,
  createCircuitBreaker,
};
