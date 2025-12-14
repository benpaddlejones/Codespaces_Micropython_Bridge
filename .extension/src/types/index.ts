/**
 * Type definitions for Pico Bridge extension
 *
 * This module defines the core interfaces used throughout the extension
 * for server status, device information, configuration, and messaging.
 */

/**
 * Represents the current status of the bridge server.
 */
export interface ServerStatus {
  /** Whether the bridge server is currently running */
  running: boolean;
  /** The port number the server is listening on */
  port: number;
  /** Timestamp when the server was started (undefined if not running) */
  startTime?: Date;
  /** The URL to access the bridge interface (undefined if not running) */
  url?: string;
}

/**
 * Information about a connected MicroPython device.
 *
 * @remarks
 * This interface is designed for future use when device detection
 * is implemented in the bridge server.
 */
export interface DeviceInfo {
  /** Whether a device is currently connected */
  connected: boolean;
  /** The device's display name (e.g., "Raspberry Pi Pico") */
  name?: string;
  /** The device type for board-specific features */
  type?: "pico" | "pico-w" | "pico2" | "esp32" | "unknown";
  /** The serial port path (e.g., "/dev/ttyUSB0" or "COM3") */
  port?: string;
}

/**
 * Extension configuration structure.
 *
 * Mirrors the configuration schema defined in package.json.
 */
export interface PicoBridgeConfig {
  /** Server-related settings */
  server: {
    /** Port number for the bridge server (default: 3000) */
    port: number;
    /** Whether to auto-start the server on extension activation */
    autoStart: boolean;
    /** Whether to open the browser when server starts */
    openBrowserOnStart: boolean;
  };
  /** Serial communication settings */
  serial: {
    /** Baud rate for serial communication (default: 115200) */
    baudRate: number;
  };
  /** PTY (pseudo-terminal) settings for serial forwarding */
  pty: {
    /** Path for the virtual serial port symlink */
    linkPath: string;
  };
  /** User interface preferences */
  ui: {
    /** Whether to show timestamps in serial output */
    showTimestamps: boolean;
  };
  /** Project management settings */
  project: {
    /** Folders to exclude when uploading projects to device */
    excludeFolders: string[];
  };
  /** Browser settings */
  browser: {
    /** Custom browser command (empty for system default) */
    customCommand: string;
  };
}

/**
 * Represents a file or directory item on the device.
 *
 * @remarks
 * Used for displaying the device filesystem in tree views.
 */
export interface FileItem {
  /** The file or directory name */
  name: string;
  /** The full path on the device */
  path: string;
  /** True if this is a directory, false if it's a file */
  isDirectory: boolean;
  /** File size in bytes (only for files) */
  size?: number;
}

/**
 * Message structure for bridge server communication.
 *
 * @remarks
 * Used for WebSocket messages between the extension and bridge UI.
 */
export interface BridgeMessage {
  /** The type of message */
  type: "status" | "data" | "error" | "files" | "device";
  /** The message payload (type depends on message type) */
  payload: unknown;
}
