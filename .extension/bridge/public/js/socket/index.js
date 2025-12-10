/**
 * Socket.io Module
 * Handles WebSocket communication with the server.
 */

import * as store from "../state/store.js";
import { termWrite, setStatus } from "../terminal/output.js";
import { loadWorkspaceFiles } from "../tools/fileManager.js";

let socket = null;

/**
 * Initialize Socket.io connection
 * @returns {Socket} The socket instance
 */
export function initSocket() {
  if (socket) return socket;

  // eslint-disable-next-line no-undef
  socket = io();

  // Connection events
  socket.on("connect", () => {
    console.log("Socket.io connected to server");
    store.setServerConnected(true);
    updateServerStatusUI(true);
    termWrite("[Server] Bridge connected\r\n");
  });

  socket.on("disconnect", () => {
    console.log("Socket.io disconnected from server");
    store.setServerConnected(false);
    updateServerStatusUI(false);
    termWrite("\r\n[Server] Connection lost\r\n");
    setStatus("Server Disconnected", "error");
  });

  socket.on("connect_error", () => {
    console.log("Socket.io connection error");
    store.setServerConnected(false);
    updateServerStatusUI(false);
  });

  // Serial data from server (from mpremote/tools)
  socket.on("serial-data", async (data) => {
    const writer = store.getWriter();
    if (writer) {
      try {
        await writer.write(data);
        termWrite(data); // Echo to terminal
      } catch (err) {
        console.error("Write error:", err);
      }
    }
  });

  // Server status messages
  socket.on("status", (msg) => {
    termWrite("\r\n[Server] " + msg + "\r\n");
  });

  // File changes from server
  socket.on("files-changed", (data) => {
    console.log("Files changed:", data);
    loadWorkspaceFiles();
  });

  // Initial status check
  updateServerStatusUI(socket.connected);

  // Auto-reconnect attempt every 5 seconds when disconnected
  setInterval(() => {
    if (!socket.connected) {
      console.log("Attempting to reconnect to server...");
      socket.connect();
    }
  }, 5000);

  return socket;
}

/**
 * Get the socket instance
 */
export function getSocket() {
  return socket;
}

/**
 * Update server status indicator in UI
 */
function updateServerStatusUI(connected) {
  const serverStatus = document.getElementById("serverStatus");
  const restartServerBtn = document.getElementById("restartServerBtn");

  if (serverStatus) {
    serverStatus.classList.remove("connected", "disconnected");
    serverStatus.classList.add(connected ? "connected" : "disconnected");
    serverStatus.title = connected
      ? "Server Connected"
      : "Server Disconnected - Click ↻ to restart";
  }

  // Show/hide restart button
  if (restartServerBtn) {
    restartServerBtn.style.display = connected ? "none" : "flex";
  }
}

/**
 * Restart server function
 */
export async function restartServer() {
  const restartServerBtn = document.getElementById("restartServerBtn");

  if (restartServerBtn) {
    restartServerBtn.classList.add("spinning");
    restartServerBtn.disabled = true;
  }

  // Try to call the restart endpoint
  try {
    const response = await fetch("/api/restart", { method: "POST" });
    if (response.ok) {
      console.log("Server restart requested");
    }
  } catch (err) {
    console.log("Server unreachable, showing restart instructions");
  }

  // Wait and try reconnecting
  setTimeout(() => {
    if (socket) socket.connect();
    if (restartServerBtn) {
      restartServerBtn.classList.remove("spinning");
      restartServerBtn.disabled = false;
    }
  }, 2000);

  // Show helpful message
  alert(
    "Server Restart\n\n" +
      "If the server doesn't reconnect automatically:\n\n" +
      "1. Open VS Code terminal\n" +
      "2. Run: bash .devcontainer/start-bridge.sh\n\n" +
      "Or use the Command Palette (Ctrl+Shift+P):\n" +
      "Tasks: Run Task → Start Pico Bridge"
  );
}

/**
 * Setup server restart button listener
 */
export function setupRestartButton() {
  const restartServerBtn = document.getElementById("restartServerBtn");
  if (restartServerBtn) {
    restartServerBtn.addEventListener("click", restartServer);
  }
}
