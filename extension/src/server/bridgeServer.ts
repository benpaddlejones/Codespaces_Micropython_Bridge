/**
 * Bridge Server Manager
 *
 * Manages the lifecycle of the Pico Bridge server.
 * The server runs as a child process and serves the bridge web interface.
 *
 * CRITICAL: Uses vscode.env.openExternal() to open in external browser,
 * NOT webviews, because Web Serial API requires a real browser context.
 */

import { ChildProcess, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ServerStatus } from "../types";
import { Logger, getConfig } from "../utils";

export class BridgeServer implements vscode.Disposable {
  private serverProcess: ChildProcess | undefined;
  private _isRunning: boolean = false;
  private _port: number;
  private _startTime: Date | undefined;
  private logger: Logger;
  private statusBarItem: vscode.StatusBarItem;
  private context: vscode.ExtensionContext;

  // Event emitters
  private readonly _onStatusChange = new vscode.EventEmitter<ServerStatus>();
  public readonly onStatusChange = this._onStatusChange.event;

  constructor(context: vscode.ExtensionContext, logger: Logger) {
    this.logger = logger;
    this._port = getConfig().server.port;
    this.context = context;

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      "picoBridge.status",
      vscode.StatusBarAlignment.Left,
      100
    );
    this.updateStatusBar();
    this.statusBarItem.show();
    context.subscriptions.push(this.statusBarItem);
  }

  /**
   * Get current server status
   */
  get status(): ServerStatus {
    return {
      running: this._isRunning,
      port: this._port,
      startTime: this._startTime,
      url: this._isRunning ? `http://localhost:${this._port}` : undefined,
    };
  }

  /**
   * Check if server is running
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get the server port
   */
  get port(): number {
    return this._port;
  }

  /**
   * Start the bridge server
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      this.logger.warn("Bridge server is already running");
      vscode.window.showWarningMessage("Pico Bridge server is already running");
      return;
    }

    try {
      this.updateStatusBar("starting");
      this.logger.info(`Starting bridge server on port ${this._port}...`);

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
          `Server process exited with code ${code}, signal ${signal}`
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
        `Bridge server started successfully on port ${this._port}`
      );

      // Show notification with option to open browser
      const selection = await vscode.window.showInformationMessage(
        `Pico Bridge started on port ${this._port}`,
        "Open in Browser"
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
        `Failed to start Pico Bridge: ${errorMessage}`
      );
      throw error;
    }
  }

  /**
   * Stop the bridge server
   */
  async stop(): Promise<void> {
    if (!this._isRunning || !this.serverProcess) {
      this.logger.info("Bridge server is not running");
      return;
    }

    try {
      this.logger.info("Stopping bridge server...");

      // Send SIGTERM to gracefully stop
      this.serverProcess.kill("SIGTERM");

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Force kill if not stopped after 5 seconds
          if (this.serverProcess) {
            this.serverProcess.kill("SIGKILL");
          }
          resolve();
        }, 5000);

        this.serverProcess?.on("exit", () => {
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
        `Failed to stop Pico Bridge: ${errorMessage}`
      );
    }
  }

  /**
   * Open the bridge interface in external browser
   * CRITICAL: Must use openExternal, NOT webview, for Web Serial API
   */
  async openInBrowser(): Promise<void> {
    if (!this._isRunning) {
      vscode.window.showWarningMessage(
        "Bridge server is not running. Start it first."
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
            externalUri.toString()
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
   * Wait for the server to be ready
   */
  private async waitForServer(timeout: number = 10000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 500;

    return new Promise((resolve, reject) => {
      const check = async () => {
        try {
          // Simple check - just wait a bit for the server to start
          // In a real implementation, you'd make an HTTP request to check health
          if (Date.now() - startTime > 2000) {
            resolve();
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error("Server startup timeout"));
            return;
          }

          setTimeout(check, checkInterval);
        } catch {
          if (Date.now() - startTime > timeout) {
            reject(new Error("Server startup timeout"));
          } else {
            setTimeout(check, checkInterval);
          }
        }
      };

      check();
    });
  }

  /**
   * Update the status bar item
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
        "statusBarItem.errorBackground"
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
   * Update VS Code context for when clauses
   */
  private updateContext(): void {
    vscode.commands.executeCommand(
      "setContext",
      "picoBridge.serverRunning",
      this._isRunning
    );
    vscode.commands.executeCommand("setContext", "picoBridge.port", this._port);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stop();
    this._onStatusChange.dispose();
  }
}
