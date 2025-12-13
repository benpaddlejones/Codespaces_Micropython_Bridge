import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as path from "path";
import * as vscode from "vscode";
import { Logger } from "../utils";
import { EmulatorWebview } from "./webviewProvider";

// Re-export Pylance configuration functions
export { configurePylanceForMock, removePylanceConfig } from "./pylanceConfig";

interface PanelMessage {
  type: string;
  board?: string;
  data?: number[];
  pin?: string;
  value?: number;
}

const EVENT_PREFIX = "__EMU__";

function isUri(value: unknown): value is vscode.Uri {
  return value instanceof vscode.Uri;
}

function getUriFromResource(resource?: unknown): vscode.Uri | undefined {
  if (!resource) {
    return undefined;
  }

  if (Array.isArray(resource)) {
    return getUriFromResource(resource[0]);
  }

  if (typeof resource === "string") {
    return vscode.Uri.file(resource);
  }

  if (isUri(resource)) {
    return resource;
  }

  if (typeof resource === "object") {
    const candidate = resource as {
      uri?: unknown;
      resourceUri?: unknown;
      path?: unknown;
      fsPath?: unknown;
    };
    if (candidate.uri && isUri(candidate.uri)) {
      return candidate.uri;
    }
    if (candidate.resourceUri && isUri(candidate.resourceUri)) {
      return candidate.resourceUri;
    }
    if (typeof candidate.fsPath === "string") {
      return vscode.Uri.file(candidate.fsPath);
    }
    if (typeof candidate.path === "string") {
      return vscode.Uri.file(candidate.path);
    }
  }

  return undefined;
}

export class EmulatorManager {
  private webview: EmulatorWebview;
  private process: ChildProcessWithoutNullStreams | undefined;
  private stdoutBuffer = "";
  private lastScriptPath: string | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {
    this.webview = new EmulatorWebview(context, logger, (message) => {
      this.handlePanelMessage(message as PanelMessage);
    });
  }

  public registerCommands(): void {
    const openDisposable = vscode.commands.registerCommand(
      "picoBridge.openEmulator",
      () => {
        this.logger.info("Command: openEmulator");
        this.webview.show();
        this.webview.postMessage({ type: "reset" });
      }
    );

    const runDisposable = vscode.commands.registerCommand(
      "picoBridge.runActiveFileInEmulator",
      async (resource?: unknown) => {
        this.logger.info("Command: runActiveFileInEmulator");
        this.logger.info(`Resource type: ${typeof resource}`);
        this.logger.info(`Resource: ${JSON.stringify(resource, null, 2)}`);

        let targetUri = getUriFromResource(resource);
        this.logger.info(`Resolved targetUri: ${targetUri?.toString()}`);
        if (!targetUri) {
          const editor = vscode.window.activeTextEditor;
          if (!editor || editor.document.languageId !== "python") {
            vscode.window.showWarningMessage(
              "Open a Python file to run it in the emulator"
            );
            return;
          }

          if (editor.document.isUntitled) {
            vscode.window.showWarningMessage(
              "Save the Python file before running it in the emulator"
            );
            return;
          }

          if (editor.document.isDirty) {
            await editor.document.save();
          }
          targetUri = editor.document.uri;
        }

        if (targetUri.scheme !== "file") {
          vscode.window.showWarningMessage(
            "Only filesystem-based Python files can run in the emulator"
          );
          return;
        }

        const document = await vscode.workspace.openTextDocument(targetUri);
        if (document.languageId !== "python") {
          vscode.window.showWarningMessage(
            "The selected file is not a Python file"
          );
          return;
        }

        if (document.isUntitled) {
          vscode.window.showWarningMessage(
            "Save the Python file before running it in the emulator"
          );
          return;
        }

        if (document.isDirty) {
          await document.save();
        }

        this.webview.show();
        this.webview.postMessage({ type: "reset" });
        await this.runScript(document.uri);
      }
    );

    this.context.subscriptions.push(openDisposable, runDisposable);
  }

  public dispose(): void {
    this.stopProcess();
  }

  private async runScript(uri: vscode.Uri): Promise<void> {
    this.stopProcess();

    // Save the script path for replay
    this.lastScriptPath = uri.fsPath;

    const pythonExecutable = this.getPythonExecutable();
    const runnerPath = path.join(
      this.context.extensionPath,
      "emulator",
      "mock",
      "runner.py"
    );

    this.logger.info(
      `Starting emulator runner: ${pythonExecutable} ${runnerPath} ${uri.fsPath}`
    );

    const cwd = path.dirname(uri.fsPath);
    this.process = spawn(pythonExecutable, [runnerPath, uri.fsPath], {
      cwd,
      env: {
        ...process.env,
        MICROPYTHON_MOCK: "1",
      },
    });

    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (data: string) => {
      this.handleStdout(data);
    });

    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", (data: string) => {
      this.logger.error(`[emulator] ${data}`);
      this.webview.postMessage({ type: "log", level: "error", data });
    });

    this.process.on("exit", (code) => {
      this.logger.info(`Emulator runner exited with code ${code}`);
      this.webview.postMessage({ type: "exit", code });
      this.process = undefined;
    });

    this.process.on("error", (error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to launch emulator runner: ${errorMessage}`);

      // Provide user-friendly error messages based on error type
      let userMessage = "Failed to launch MicroPython emulator.";
      if (errorMessage.includes("ENOENT")) {
        userMessage =
          "Python not found. Please install Python 3 or configure 'picoBridge.emulator.pythonExecutable' in settings.";
      } else if (errorMessage.includes("EACCES")) {
        userMessage =
          "Permission denied when launching Python. Check file permissions.";
      } else {
        userMessage += ` Error: ${errorMessage}`;
      }

      vscode.window
        .showErrorMessage(userMessage, "Show Logs", "Open Settings")
        .then((selection) => {
          if (selection === "Show Logs") {
            vscode.commands.executeCommand("picoBridge.showLogs");
          } else if (selection === "Open Settings") {
            vscode.commands.executeCommand(
              "workbench.action.openSettings",
              "picoBridge.emulator"
            );
          }
        });

      this.stopProcess();
    });
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;

    let newlineIndex = this.stdoutBuffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

      if (line.startsWith(EVENT_PREFIX)) {
        const payload = line.slice(EVENT_PREFIX.length);
        try {
          const event = JSON.parse(payload);
          this.webview.postMessage(event);
        } catch (error) {
          this.logger.error(
            `Failed to parse emulator event: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } else if (line) {
        this.logger.info(`[emulator] ${line}`);
        this.webview.postMessage({ type: "log", level: "info", data: line });
      }

      newlineIndex = this.stdoutBuffer.indexOf("\n");
    }
  }

  private handlePanelMessage(message: PanelMessage): void {
    if (!message || typeof message !== "object") {
      return;
    }

    switch (message.type) {
      case "play":
      case "restart":
        if (this.lastScriptPath) {
          this.logger.info(
            `Panel requested ${message.type}, replaying: ${this.lastScriptPath}`
          );
          this.webview.postMessage({ type: "reset" });
          this.runScript(vscode.Uri.file(this.lastScriptPath));
        } else {
          this.logger.warn("No script to replay");
          this.webview.postMessage({
            type: "log",
            level: "warn",
            data: "No script loaded. Right-click a Python file and select 'Run in MicroPython Emulator'",
          });
        }
        break;
      case "stop":
        this.logger.info("Panel requested stop");
        this.stopProcess();
        break;
      case "pause":
        this.logger.info("Panel requested pause");
        if (this.process) {
          this.process.kill("SIGSTOP");
        }
        break;
      case "resume":
        this.logger.info("Panel requested resume");
        if (this.process) {
          this.process.kill("SIGCONT");
        }
        break;
      case "reset":
        this.logger.info("Panel requested reset");
        this.stopProcess();
        this.webview.postMessage({ type: "reset" });
        break;
      case "board_change":
        this.logger.info(`Board changed to: ${message.board}`);
        // Board change is handled by the panel itself for now
        break;
      case "i2c_read_response":
        this.logger.info(
          `I2C read response set: ${JSON.stringify(message.data)}`
        );
        // TODO: Send to Python process via stdin when we implement bidirectional comm
        break;
      case "i2c_clear_response":
        this.logger.info("I2C read response cleared - using auto-response");
        // TODO: Send to Python process via stdin when we implement bidirectional comm
        break;
      case "adc_set_value":
        this.logger.info(
          `ADC value set: pin=${message.pin}, value=${message.value}`
        );
        // TODO: Send to Python process via stdin when we implement bidirectional comm
        break;
      case "adc_clear_override":
        this.logger.info(`ADC override cleared: pin=${message.pin}`);
        // TODO: Send to Python process via stdin when we implement bidirectional comm
        break;
      default:
        this.logger.warn(`Unhandled panel message: ${JSON.stringify(message)}`);
        break;
    }
  }

  private stopProcess(): void {
    if (this.process) {
      this.logger.info("Stopping emulator runner");
      this.process.kill();
      this.process = undefined;
    }
    this.stdoutBuffer = "";
  }

  private getPythonExecutable(): string {
    const config = vscode.workspace.getConfiguration("picoBridge.emulator");
    return config.get<string>("pythonExecutable", "python3");
  }
}
