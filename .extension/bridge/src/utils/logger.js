/**
 * Simple logger utility.
 * Provides consistent logging format across the application.
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Default log level (can be set via LOG_LEVEL env variable)
let currentLevel =
  LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Creates a prefixed logger for a module.
 *
 * @param {string} prefix - Module prefix (e.g., 'pty', 'api')
 * @returns {Object} Logger object with debug, info, warn, error methods
 */
function createLogger(prefix) {
  const tag = `[${prefix}]`;

  return {
    debug: (...args) => {
      if (currentLevel <= LOG_LEVELS.DEBUG) {
        console.log(tag, ...args);
      }
    },
    info: (...args) => {
      if (currentLevel <= LOG_LEVELS.INFO) {
        console.log(tag, ...args);
      }
    },
    warn: (...args) => {
      if (currentLevel <= LOG_LEVELS.WARN) {
        console.warn(tag, ...args);
      }
    },
    error: (...args) => {
      if (currentLevel <= LOG_LEVELS.ERROR) {
        console.error(tag, ...args);
      }
    },
  };
}

/**
 * Sets the global log level.
 *
 * @param {string} level - 'DEBUG', 'INFO', 'WARN', or 'ERROR'
 */
function setLevel(level) {
  const newLevel = LOG_LEVELS[level.toUpperCase()];
  if (newLevel !== undefined) {
    currentLevel = newLevel;
  }
}

/**
 * Gets the current log level name.
 *
 * @returns {string}
 */
function getLevel() {
  return Object.keys(LOG_LEVELS).find(
    (key) => LOG_LEVELS[key] === currentLevel
  );
}

module.exports = {
  createLogger,
  setLevel,
  getLevel,
  LOG_LEVELS,
};
