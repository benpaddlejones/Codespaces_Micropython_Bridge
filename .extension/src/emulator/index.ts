import { ChildProcessWithoutNullStreams, spawn } from "child_process";
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
      async (resource?: vscode.Uri) => {
        this.logger.info("Command: runActiveFileInEmulator");

        let targetUri: vscode.Uri | undefined = resource;
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

    this.context.subscriptions.push(openDisposable, runDisposable);
  }

  public dispose(): void {
    this.stopProcess();
  }

  private async runScript(uri: vscode.Uri): Promise<void> {
    this.stopProcess();

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
}
