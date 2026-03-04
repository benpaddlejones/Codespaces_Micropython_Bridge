/**
 * Bridge Server Manager
 *
 * Manages the lifecycle of the Pico Bridge server.
 * The server runs as a child process and serves the bridge web interface.
 *
 * CRITICAL: Uses vscode.env.openExternal() to open in external browser,
 * NOT webviews, because Web Serial API requires a real browser context.
 */

import { ChildProcess, exec, spawn } from "child_process";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import { promisify } from "util";
import * as vscode from "vscode";
import { ServerStatus } from "../types";
import { Logger, getConfig } from "../utils";

const execAsync = promisify(exec);

/**
 * Kill any processes running on the specified ports.
 *
 * Runs `lsof` to discover PIDs bound to each port and sends `SIGKILL`
 * to free them. Waits briefly after killing to let the OS release the port.
 *
 * @param ports - Array of port numbers to clear
 * @param logger - Logger instance for status messages
 */
async function killProcessesOnPorts(
  ports: number[],
  logger: Logger,
): Promise<void> {
  for (const port of ports) {
    try {
      // Find PIDs using the port
      const { stdout } = await execAsync(
        `lsof -ti :${port} 2>/dev/null || true`,
      );
      const pids = stdout.trim().split("\n").filter(Boolean);

      if (pids.length > 0) {
        logger.info(`Found processes on port ${port}: ${pids.join(", ")}`);
        for (const pid of pids) {
          try {
            await execAsync(`kill -9 ${pid} 2>/dev/null || true`);
            logger.info(`Killed process ${pid} on port ${port}`);
          } catch {
            // Process may have already exited
          }
        }
        // Wait for ports to be released
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      logger.warn(`Could not check/kill processes on port ${port}: ${error}`);
    }
  }
}

/**
 * Manages the Pico Bridge server lifecycle.
 *
 * The bridge server is a Node.js child process that serves the web
 * interface for serial communication with MicroPython devices.
 * It must run in an external browser (not a webview) because the
 * Web Serial API is not available inside VS Code webviews.
 *
 * Responsibilities:
 * - Starting and stopping the bridge server process
 * - Port conflict resolution
 * - Status bar updates
 * - Opening the bridge UI in an external browser
 * - Health-check polling during startup
 */
export class BridgeServer implements vscode.Disposable {
  private serverProcess: ChildProcess | undefined;
  private _isRunning: boolean = false;
  private _isStopping: boolean = false;
  private _port: number;
  private _startTime: Date | undefined;
  private readonly logger: Logger;
  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly context: vscode.ExtensionContext;
  private disposed: boolean = false;

  // Event emitters
  private readonly _onStatusChange = new vscode.EventEmitter<ServerStatus>();
  public readonly onStatusChange = this._onStatusChange.event;

  /**
   * Create a new BridgeServer instance.
   *
   * Initialises the status bar item and reads the configured server port.
   * Does **not** start the server — call `start()` explicitly.
   *
   * @param context - Extension context used for subscriptions and asset paths
   * @param logger - Logger instance for server lifecycle messages
   */
  constructor(context: vscode.ExtensionContext, logger: Logger) {
    this.logger = logger;
    this._port = getConfig().server.port;
    this.context = context;

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      "picoBridge.status",
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.updateStatusBar();
    this.statusBarItem.show();
    context.subscriptions.push(this.statusBarItem);
  }

  /** Get the current server status snapshot. */
  get status(): ServerStatus {
    return {
      running: this._isRunning,
      port: this._port,
      startTime: this._startTime,
      url: this._isRunning ? `http://localhost:${this._port}` : undefined,
    };
  }

  /** Whether the bridge server process is currently running. */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /** The port number the server is configured to listen on. */
  get port(): number {
    return this._port;
  }

  /**
   * Start the bridge server.
   *
   * Kills any existing processes on the configured port, spawns the
   * server as a child process, waits for the health endpoint to respond,
   * and sets up port forwarding for Codespaces/Remote environments.
   *
   * @throws Error if no workspace folder is open or the server fails to start
   */
  async start(): Promise<void> {
    if (this.disposed) {
      throw new Error("BridgeServer has been disposed");
    }

    if (this._isRunning) {
      this.logger.warn("Bridge server is already running");
      vscode.window.showWarningMessage("Pico Bridge server is already running");
      return;
    }

    if (this._isStopping) {
      this.logger.warn("Bridge server is currently stopping, please wait");
      vscode.window.showWarningMessage(
        "Pico Bridge server is stopping, please wait...",
      );
      return;
    }

    try {
      this.updateStatusBar("starting");
      this.logger.info(`Starting bridge server on port ${this._port}...`);

      // Kill any existing processes on ports 3000 and 3001
      this.logger.info(
        "Killing any existing processes on ports 3000 and 3001...",
      );
      await killProcessesOnPorts([3000, 3001], this.logger);

      // Determine workspace root for project access
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No workspace folder open");
      }
      const workspaceRoot = workspaceFolders[0].uri.fsPath;

      // Resolve bridge assets inside the extension bundle
      const bridgePath = this.context.asAbsolutePath("bridge");
      const serverScript = path.join(bridgePath, "server.js");

      this.logger.info(`Bridge path: ${bridgePath}`);
      this.logger.info(`Server script: ${serverScript}`);

      if (!fs.existsSync(serverScript)) {
        throw new Error(`Bridge server not found at ${serverScript}`);
      }

      // Start the server process
      this.serverProcess = spawn(process.execPath, [serverScript], {
        cwd: bridgePath,
        env: {
          ...process.env,
          PORT: this._port.toString(),
          NODE_ENV: "production",
          PICO_BRIDGE_WORKSPACE_ROOT: workspaceRoot,
        },
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Handle stdout
      this.serverProcess.stdout?.on("data", (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          this.logger.info(`[server] ${message}`);
        }
      });

      // Handle stderr
      this.serverProcess.stderr?.on("data", (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          this.logger.warn(`[server] ${message}`);
        }
      });

      // Handle process exit
      this.serverProcess.on("exit", (code, signal) => {
        this.logger.info(
          `Server process exited with code ${code}, signal ${signal}`,
        );
        this._isRunning = false;
        this._startTime = undefined;
        this.updateStatusBar();
        this.updateContext();
        this._onStatusChange.fire(this.status);
      });

      // Handle process error
      this.serverProcess.on("error", (err) => {
        this.logger.error(`Server process error: ${err.message}`);
        this._isRunning = false;
        this.updateStatusBar("error");
        vscode.window.showErrorMessage(`Bridge server error: ${err.message}`);
      });

      // Wait a moment for the server to start
      await this.waitForServer();

      this._isRunning = true;
      this._startTime = new Date();
      this.updateStatusBar();
      this.updateContext();
      this._onStatusChange.fire(this.status);

      this.logger.info(
        `Bridge server started successfully on port ${this._port}`,
      );

      // Ensure port is forwarded in Codespaces/Remote environments
      // This triggers VS Code to register the port forwarding
      try {
        const localUri = vscode.Uri.parse(`http://localhost:${this._port}`);
        const externalUri = await vscode.env.asExternalUri(localUri);
        this.logger.info(
          `Port ${this._port} forwarded to: ${externalUri.toString()}`,
        );
      } catch (error) {
        this.logger.warn(`Could not set up port forwarding: ${error}`);
      }

      // Show notification with option to open browser
      const selection = await vscode.window.showInformationMessage(
        `Pico Bridge started on port ${this._port}`,
        "Open in Browser",
      );

      if (selection === "Open in Browser") {
        await this.openInBrowser();
      }
    } catch (error) {
      this._isRunning = false;
      this.updateStatusBar("error");
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to start bridge server: ${errorMessage}`);
      vscode.window.showErrorMessage(
        `Failed to start Pico Bridge: ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Stop the bridge server.
   *
   * Sends `SIGTERM` and waits up to 5 seconds for a graceful shutdown
   * before force-killing the process with `SIGKILL`.
   */
  async stop(): Promise<void> {
    if (!this._isRunning || !this.serverProcess) {
      this.logger.info("Bridge server is not running");
      return;
    }

    if (this._isStopping) {
      this.logger.info("Bridge server is already stopping");
      return;
    }

    this._isStopping = true;

    try {
      this.logger.info("Stopping bridge server...");

      const processToKill = this.serverProcess;

      // Send SIGTERM to gracefully stop
      processToKill.kill("SIGTERM");

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Force kill if not stopped after 5 seconds
          if (processToKill && !processToKill.killed) {
            this.logger.warn("Force killing server process...");
            processToKill.kill("SIGKILL");
          }
          resolve();
        }, 5000);

        processToKill.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.serverProcess = undefined;
      this._isRunning = false;
      this._startTime = undefined;
      this.updateStatusBar();
      this.updateContext();
      this._onStatusChange.fire(this.status);

      this.logger.info("Bridge server stopped");
      vscode.window.showInformationMessage("Pico Bridge server stopped");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to stop bridge server: ${errorMessage}`);
      vscode.window.showErrorMessage(
        `Failed to stop Pico Bridge: ${errorMessage}`,
      );
    } finally {
      this._isStopping = false;
    }
  }

  /**
   * Open the bridge interface in an external browser.
   *
   * Uses `vscode.env.asExternalUri` for proper port forwarding in
   * Codespaces and Remote SSH environments, then opens the resulting
   * URL via `vscode.env.openExternal`.
   *
   * CRITICAL: Must use `openExternal`, NOT a webview, because the
   * Web Serial API is only available in a real browser context.
   */
  async openInBrowser(): Promise<void> {
    if (!this._isRunning) {
      vscode.window.showWarningMessage(
        "Bridge server is not running. Start it first.",
      );
      return;
    }

    try {
      // Create local URI
      const localUri = vscode.Uri.parse(`http://localhost:${this._port}`);

      // Use asExternalUri for proper port forwarding in Codespaces/Remote
      const externalUri = await vscode.env.asExternalUri(localUri);

      this.logger.info(`Opening browser: ${externalUri.toString()}`);

      // Open in external browser (CRITICAL: NOT webview for Web Serial API)
      const success = await vscode.env.openExternal(externalUri);

      if (success) {
        this.logger.info("Browser opened successfully");
      } else {
        this.logger.warn("Failed to open browser");
        vscode.window.showWarningMessage(
          "Could not open browser. Please manually navigate to: " +
            externalUri.toString(),
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to open browser: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to open browser: ${errorMessage}`);
    }
  }

  /**
   * Wait for the server to become ready by polling the health endpoint.
   *
   * Sends HTTP GET requests to `/api/health` at regular intervals until
   * a 200 response is received or the timeout is exceeded.
   *
   * @param timeout - Maximum time to wait in milliseconds (default: 10 000)
   * @throws Error if the server does not respond within the timeout
   */
  private async waitForServer(timeout: number = 10000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 500;

    return new Promise((resolve, reject) => {
      const check = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error("Server startup timeout"));
          return;
        }

        // Make HTTP request to check if server is ready
        const req = http.request(
          {
            hostname: "localhost",
            port: this._port,
            path: "/api/health",
            method: "GET",
            timeout: 2000,
          },
          (res) => {
            if (res.statusCode === 200) {
              resolve();
            } else {
              setTimeout(check, checkInterval);
            }
          },
        );

        req.on("error", () => {
          // Server not ready yet, try again
          setTimeout(check, checkInterval);
        });

        req.on("timeout", () => {
          req.destroy();
          setTimeout(check, checkInterval);
        });

        req.end();
      };

      // Start checking after a brief delay to give the process time to start
      setTimeout(check, 500);
    });
  }

  /**
   * Update the status bar item to reflect the current server state.
   *
   * @param state - Optional override: `'starting'` shows a spinner,
   *                `'error'` shows an error icon. When omitted the
   *                status is derived from `_isRunning`.
   */
  private updateStatusBar(state?: "starting" | "error"): void {
    if (state === "starting") {
      this.statusBarItem.text = "$(sync~spin) Pico Bridge: Starting...";
      this.statusBarItem.tooltip = "Starting Pico Bridge server...";
      this.statusBarItem.command = undefined;
      this.statusBarItem.backgroundColor = undefined;
    } else if (state === "error") {
      this.statusBarItem.text = "$(error) Pico Bridge: Error";
      this.statusBarItem.tooltip =
        "Pico Bridge encountered an error. Click to retry.";
      this.statusBarItem.command = "picoBridge.startServer";
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground",
      );
    } else if (this._isRunning) {
      this.statusBarItem.text = `$(broadcast) Pico Bridge: Port ${this._port}`;
      this.statusBarItem.tooltip = `Pico Bridge is running on port ${this._port}. Click to open in browser.`;
      this.statusBarItem.command = "picoBridge.openBrowser";
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = "$(plug) Pico Bridge";
      this.statusBarItem.tooltip = "Click to start Pico Bridge server";
      this.statusBarItem.command = "picoBridge.startServer";
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  /**
   * Synchronise VS Code context keys (`picoBridge.serverRunning`, `picoBridge.port`)
   * so that `when`-clause expressions in `package.json` can react to server state.
   */
  private updateContext(): void {
    vscode.commands.executeCommand(
      "setContext",
      "picoBridge.serverRunning",
      this._isRunning,
    );
    vscode.commands.executeCommand("setContext", "picoBridge.port", this._port);
  }

  /**
   * Dispose all resources owned by this instance.
   *
   * Force-kills the server process if it is still running and
   * disposes the status-change event emitter.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    // Synchronously kill the process if running
    if (this.serverProcess && !this.serverProcess.killed) {
      this.serverProcess.kill("SIGKILL");
      this.serverProcess = undefined;
    }

    this._isRunning = false;
    this._onStatusChange.dispose();
  }
}
