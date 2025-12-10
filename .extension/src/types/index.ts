/**
 * Type definitions for Pico Bridge extension
 */

export interface ServerStatus {
  running: boolean;
  port: number;
  startTime?: Date;
  url?: string;
}

export interface DeviceInfo {
  connected: boolean;
  name?: string;
  type?: "pico" | "pico-w" | "pico2" | "esp32" | "unknown";
  port?: string;
}

export interface PicoBridgeConfig {
  server: {
    port: number;
    autoStart: boolean;
    openBrowserOnStart: boolean;
  };
  serial: {
    baudRate: number;
  };
  pty: {
    linkPath: string;
  };
  ui: {
    showTimestamps: boolean;
  };
  project: {
    excludeFolders: string[];
  };
  browser: {
    customCommand: string;
  };
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export interface BridgeMessage {
  type: "status" | "data" | "error" | "files" | "device";
  payload: unknown;
}
