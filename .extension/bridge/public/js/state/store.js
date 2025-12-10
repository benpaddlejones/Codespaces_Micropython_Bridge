/**
 * Centralized State Store
 * Manages all application state and provides subscription-based updates.
 */

// State structure
const state = {
  // Serial connection state
  serial: {
    port: null,
    reader: null,
    writer: null,
    connected: false,
    keepReading: false,
  },

  // Server/socket state
  server: {
    connected: false,
  },

  // Project detection state
  project: {
    detected: false,
    root: null, // Relative path to project root from workspace
  },

  // Device detection state
  device: {
    info: null, // { board, variant, name, version, buildDate }
    detected: false,
  },

  // UI state
  ui: {
    silentMode: false,
    showTimestamp: false,
    lastCharWasNewline: true,
  },

  // Plotter state
  plotter: {
    enabled: false,
    frozen: false,
    fullscreen: false,
    autoScale: true,
    data: {},
    lineBuffer: "",
    maxPoints: 500,
    labels: null, // Store header labels from first line (Arduino Serial Plotter style)
  },

  // Log buffer for download
  logBuffer: "",
};

// Subscribers for state changes
const subscribers = new Map();

/**
 * Get current state (readonly copy)
 */
export function getState() {
  return { ...state };
}

/**
 * Get specific state section
 */
export function getSection(section) {
  return state[section] ? { ...state[section] } : null;
}

/**
 * Update state section
 */
export function updateState(section, updates) {
  if (state[section]) {
    state[section] = { ...state[section], ...updates };
    notifySubscribers(section);
  }
}

/**
 * Set specific state value
 */
export function setState(section, key, value) {
  if (state[section]) {
    state[section][key] = value;
    notifySubscribers(section);
  }
}

/**
 * Subscribe to state changes
 * @param {string} section - State section to watch ('serial', 'plotter', etc.)
 * @param {function} callback - Called with new state when it changes
 * @returns {function} Unsubscribe function
 */
export function subscribe(section, callback) {
  if (!subscribers.has(section)) {
    subscribers.set(section, new Set());
  }
  subscribers.get(section).add(callback);

  // Return unsubscribe function
  return () => {
    subscribers.get(section).delete(callback);
  };
}

/**
 * Notify subscribers of state change
 */
function notifySubscribers(section) {
  const sectionSubscribers = subscribers.get(section);
  if (sectionSubscribers) {
    const sectionState = { ...state[section] };
    sectionSubscribers.forEach((callback) => callback(sectionState));
  }
}

// === Serial State Helpers ===

export function setSerialPort(port) {
  state.serial.port = port;
  state.serial.connected = port !== null;
  notifySubscribers("serial");
}

export function setSerialWriter(writer) {
  state.serial.writer = writer;
  notifySubscribers("serial");
}

export function setSerialReader(reader) {
  state.serial.reader = reader;
  notifySubscribers("serial");
}

export function setKeepReading(keepReading) {
  state.serial.keepReading = keepReading;
  notifySubscribers("serial");
}

export function isConnected() {
  return state.serial.connected && state.serial.writer !== null;
}

export function getWriter() {
  return state.serial.writer;
}

export function getReader() {
  return state.serial.reader;
}

export function getPort() {
  return state.serial.port;
}

// === Server State Helpers ===

export function setServerConnected(connected) {
  state.server.connected = connected;
  notifySubscribers("server");
}

export function isServerConnected() {
  return state.server.connected;
}

// === Project State Helpers ===

export function setProjectDetected(detected) {
  state.project.detected = detected;
  notifySubscribers("project");
}

export function isProjectDetected() {
  return state.project.detected;
}

export function setProjectRoot(root) {
  state.project.root = root;
  notifySubscribers("project");
}

export function getProjectRoot() {
  return state.project.root;
}

// === Device State Helpers ===

export function setDeviceInfo(info) {
  state.device.info = info;
  state.device.detected = info !== null;
  notifySubscribers("device");
}

export function getDeviceInfo() {
  return state.device.info;
}

export function isDeviceDetected() {
  return state.device.detected;
}

export function clearDeviceInfo() {
  state.device.info = null;
  state.device.detected = false;
  notifySubscribers("device");
}

// === UI State Helpers ===

export function setSilentMode(silent) {
  state.ui.silentMode = silent;
}

export function isSilentMode() {
  return state.ui.silentMode;
}

export function setShowTimestamp(show) {
  state.ui.showTimestamp = show;
}

export function isShowTimestamp() {
  return state.ui.showTimestamp;
}

export function setLastCharWasNewline(value) {
  state.ui.lastCharWasNewline = value;
}

export function getLastCharWasNewline() {
  return state.ui.lastCharWasNewline;
}

// === Log Buffer Helpers ===

export function appendToLogBuffer(text) {
  state.logBuffer += text;
}

export function getLogBuffer() {
  return state.logBuffer;
}

export function clearLogBuffer() {
  state.logBuffer = "";
}

// === Plotter State Helpers ===

export function getPlotterState() {
  return { ...state.plotter };
}

export function setPlotterEnabled(enabled) {
  state.plotter.enabled = enabled;
  notifySubscribers("plotter");
}

export function isPlotterEnabled() {
  return state.plotter.enabled;
}

export function setPlotterFrozen(frozen) {
  state.plotter.frozen = frozen;
  notifySubscribers("plotter");
}

export function isPlotterFrozen() {
  return state.plotter.frozen;
}

export function setPlotterFullscreen(fullscreen) {
  state.plotter.fullscreen = fullscreen;
  notifySubscribers("plotter");
}

export function isPlotterFullscreen() {
  return state.plotter.fullscreen;
}

export function setPlotterAutoScale(autoScale) {
  state.plotter.autoScale = autoScale;
  notifySubscribers("plotter");
}

export function getPlotterData() {
  return state.plotter.data;
}

export function setPlotterData(data) {
  state.plotter.data = data;
}

export function addPlotterValue(label, value) {
  if (!state.plotter.data[label]) {
    state.plotter.data[label] = [];
  }
  state.plotter.data[label].push(value);

  // Limit data points
  if (state.plotter.data[label].length > state.plotter.maxPoints) {
    state.plotter.data[label].shift();
  }
}
export function clearPlotterData() {
  state.plotter.data = {};
  state.plotter.lineBuffer = "";
  state.plotter.labels = null; // Clear labels when clearing data
  notifySubscribers("plotter");
}

export function getPlotterLineBuffer() {
  return state.plotter.lineBuffer;
}

export function setPlotterLineBuffer(buffer) {
  state.plotter.lineBuffer = buffer;
}

export function getPlotterMaxPoints() {
  return state.plotter.maxPoints;
}

export function getPlotterLabels() {
  return state.plotter.labels;
}

export function setPlotterLabels(labels) {
  state.plotter.labels = labels;
}
