import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { Logger } from "../utils";
import { EmulatorWebview } from "./webviewProvider";

interface PanelMessage {
  type: string;
}

const EVENT_PREFIX = "__EMU__";

export class EmulatorManager {
  private webview: EmulatorWebview;
  private process: ChildProcessWithoutNullStreams | undefined;
  private stdoutBuffer = "";
  private readonly defaultBoard = "raspberry-pi-pico";

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {
    this.webview = new EmulatorWebview(context, logger, (message) => {
      this.handlePanelMessage(message as PanelMessage);
    });
  }

  public registerCommands(): void {
    void this.ensureLaunchConfiguration();
    void this.configurePylance();

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
      async (resource?: vscode.Uri | { uri: vscode.Uri }) => {
        this.logger.info("Command: runActiveFileInEmulator");

        // Handle both Uri and tree item (which has .uri property)
        let targetUri: vscode.Uri | undefined;
        if (resource) {
          targetUri = resource instanceof vscode.Uri ? resource : resource.uri;
        }

        if (!targetUri) {
          const editor = vscode.window.activeTextEditor;
          if (!editor || editor.document.languageId !== "python") {
            vscode.window.showWarningMessage(
              "Open a Python file to run it in the emulator"
            );
            return;
          }

          if (editor.document.isDirty) {
            await editor.document.save();
          }
          targetUri = editor.document.uri;
        }

        const document = await vscode.workspace.openTextDocument(targetUri);
        if (document.isDirty) {
          await document.save();
        }

        this.webview.show();
        this.webview.postMessage({ type: "reset" });
        await this.runScript(document.uri);
      }
    );

    const viewPinoutDisposable = vscode.commands.registerCommand(
      "picoBridge.viewPinout",
      async () => {
        this.logger.info("Command: viewPinout");
        await this.showPinoutDiagram();
      }
    );

    const debugPythonDisposable = vscode.commands.registerCommand(
      "picoBridge.debugPythonFile",
      async (resource?: vscode.Uri | { uri: vscode.Uri }) => {
        this.logger.info("Command: debugPythonFile");

        let targetUri: vscode.Uri | undefined;
        if (resource) {
          targetUri = resource instanceof vscode.Uri ? resource : resource.uri;
        }

        if (!targetUri) {
          const editor = vscode.window.activeTextEditor;
          if (!editor || editor.document.languageId !== "python") {
            vscode.window.showWarningMessage("Open a Python file to debug");
            return;
          }
          targetUri = editor.document.uri;
        }

        // Use runner.py as the program - it sets up paths safely at runtime
        const runnerPath = this.getRunnerPath();
        const scriptDir = path.dirname(targetUri.fsPath);

        await vscode.debug.startDebugging(undefined, {
          type: "debugpy",
          name: "Debug MicroPython File",
          request: "launch",
          program: runnerPath,
          args: [targetUri.fsPath],
          console: "integratedTerminal",
          cwd: scriptDir,
          env: {
            MICROPYTHON_MOCK: "1",
          },
        });
      }
    );

    const runnerPathDisposable = vscode.commands.registerCommand(
      "picoBridge.getMockRunnerPath",
      () => {
        const runnerPath = this.getRunnerPath();
        this.logger.info(`Command: getMockRunnerPath -> ${runnerPath}`);
        return runnerPath;
      }
    );

    const mockPathDisposable = vscode.commands.registerCommand(
      "picoBridge.getMockPath",
      () => {
        const mockPath = this.getMockRoot();
        this.logger.info(`Command: getMockPath -> ${mockPath}`);
        return mockPath;
      }
    );

    const boardDisposable = vscode.commands.registerCommand(
      "picoBridge.getSelectedBoard",
      () => {
        const board = this.getBoardIdentifier();
        this.logger.info(`Command: getSelectedBoard -> ${board}`);
        return board;
      }
    );

    this.context.subscriptions.push(
      openDisposable,
      runDisposable,
      viewPinoutDisposable,
      debugPythonDisposable,
      runnerPathDisposable,
      mockPathDisposable,
      boardDisposable
    );
  }

  public dispose(): void {
    this.stopProcess();
  }

  private async runScript(uri: vscode.Uri): Promise<void> {
    this.stopProcess();

    const pythonExecutable = this.getPythonExecutable();
    const runnerPath = this.getRunnerPath();

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
      this.logger.error(
        `Failed to launch emulator runner: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      vscode.window.showErrorMessage(
        "Failed to launch emulator runner. Check logs for details."
      );
      this.stopProcess();
    });
  }

  private getRunnerPath(): string {
    return path.join(this.getMockRoot(), "runner.py");
  }

  private getMockRoot(): string {
    return path.join(this.context.extensionPath, "emulator", "mock");
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
      case "reset":
        this.logger.info("Panel requested reset");
        this.stopProcess();
        this.webview.postMessage({ type: "reset" });
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

  private getBoardIdentifier(): string {
    const config = vscode.workspace.getConfiguration("picoBridge.emulator");
    return config.get<string>("board", this.defaultBoard);
  }

  private async ensureLaunchConfiguration(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.logger.info(
        "Skipping launch configuration setup: no workspace folder detected"
      );
      return;
    }

    const workspaceFolder = workspaceFolders[0];
    const launchConfig = vscode.workspace.getConfiguration(
      "launch",
      workspaceFolder.uri
    );

    const configurations =
      launchConfig.get<unknown[]>("configurations")?.slice() ?? [];

    const existing = configurations.find((entry) => {
      if (typeof entry !== "object" || !entry) {
        return false;
      }
      const candidate = entry as { name?: unknown };
      return candidate.name === "MicroPython (Emulator)";
    });

    if (!existing) {
      const newConfig = {
        name: "MicroPython (Emulator)",
        type: "python",
        request: "launch",
        program: "${command:picoBridge.getMockRunnerPath}",
        args: ["${file}"],
        console: "integratedTerminal",
        env: {
          MICROPYTHON_MOCK: "1",
          MOCK_BOARD: "${command:picoBridge.getSelectedBoard}",
          MOCK_PATH: "${command:picoBridge.getMockPath}",
        },
      };

      configurations.push(newConfig);
      try {
        await launchConfig.update(
          "configurations",
          configurations,
          vscode.ConfigurationTarget.WorkspaceFolder
        );
        this.logger.info("Created MicroPython (Emulator) launch configuration");
      } catch (error) {
        this.logger.error(
          `Failed to update launch configuration: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    const version = launchConfig.get<string>("version");
    if (!version) {
      try {
        await launchConfig.update(
          "version",
          "0.2.0",
          vscode.ConfigurationTarget.WorkspaceFolder
        );
      } catch (error) {
        this.logger.error(
          `Failed to set launch.json version: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  private async showPinoutDiagram(): Promise<void> {
    const board = this.getBoardIdentifier();
    let pinoutFile = "pico-pinout.svg";

    if (board.includes("esp32")) {
      pinoutFile = "esp32-pinout.svg";
    } else if (board.includes("pico-w")) {
      pinoutFile = "pico-w-pinout.svg";
    }

    const pinoutPath = path.join(
      this.context.extensionPath,
      "media",
      "pinouts",
      pinoutFile
    );

    if (fs.existsSync(pinoutPath)) {
      const uri = vscode.Uri.file(pinoutPath);
      await vscode.commands.executeCommand("vscode.open", uri);
    } else {
      // Fallback: open in browser for official pinout
      const urls: Record<string, string> = {
        "raspberry-pi-pico":
          "https://datasheets.raspberrypi.com/pico/Pico-R3-A4-Pinout.pdf",
        "raspberry-pi-pico-w":
          "https://datasheets.raspberrypi.com/picow/PicoW-A4-Pinout.pdf",
        esp32:
          "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/hw-reference/esp32/get-started-devkitc.html",
      };

      const url =
        urls[board] ||
        "https://datasheets.raspberrypi.com/pico/Pico-R3-A4-Pinout.pdf";
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }
  }

  private async configurePylance(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const mockPath = this.getMockRoot();
    const micropythonPath = path.join(mockPath, "micropython");
    const typingsPath = path.join(mockPath, "typings");

    const config = vscode.workspace.getConfiguration(
      "python.analysis",
      workspaceFolders[0].uri
    );

    // Get current extraPaths
    const extraPaths = config.get<string[]>("extraPaths") || [];
    const pathsToAdd = [micropythonPath, typingsPath];
    let needsUpdate = false;

    for (const p of pathsToAdd) {
      if (!extraPaths.includes(p)) {
        extraPaths.push(p);
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      try {
        await config.update(
          "extraPaths",
          extraPaths,
          vscode.ConfigurationTarget.Workspace
        );
        this.logger.info(
          `Configured Pylance extraPaths for MicroPython emulator`
        );
      } catch (error) {
        this.logger.error(
          `Failed to configure Pylance: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }
}
