/**
 * Command Registrations for Pico Bridge Extension
 *
 * Registers all commands defined in package.json and wires them
 * to the appropriate functionality.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { BridgeServer } from "../server";
import { Logger } from "../utils";

function isUri(value: unknown): value is vscode.Uri {
  return value instanceof vscode.Uri;
}

function resolveUri(resource: unknown): vscode.Uri | undefined {
  if (!resource) {
    return undefined;
  }

  if (Array.isArray(resource)) {
    return resolveUri(resource[0]);
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

export function registerCommands(
  context: vscode.ExtensionContext,
  server: BridgeServer,
  logger: Logger
): void {
  // Server lifecycle commands
  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.startServer", async () => {
      logger.info("Command: startServer");
      await server.start();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.stopServer", async () => {
      logger.info("Command: stopServer");
      await server.stop();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.openBrowser", async () => {
      logger.info("Command: openBrowser");
      await server.openInBrowser();
    })
  );

  // Show logs command
  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.showLogs", () => {
      logger.info("Command: showLogs");
      logger.show();
    })
  );

  // File operations - these send messages via WebSocket to the bridge UI
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "picoBridge.runFile",
      async (uri?: vscode.Uri) => {
        logger.info("Command: runFile");

        // Get active file if no URI provided
        if (!uri) {
          const activeEditor = vscode.window.activeTextEditor;
          if (!activeEditor) {
            vscode.window.showWarningMessage("No file selected to run");
            return;
          }
          uri = activeEditor.document.uri;
        }

        if (!server.isRunning) {
          const start = await vscode.window.showInformationMessage(
            "Bridge server is not running. Start it first?",
            "Start Server"
          );
          if (start === "Start Server") {
            await server.start();
          } else {
            return;
          }
        }

        // Open browser to run the file
        // The bridge UI handles file execution
        await server.openInBrowser();
        vscode.window.showInformationMessage(
          `Ready to run ${uri.fsPath}. Connect to device in browser and use the Run button.`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "picoBridge.uploadFile",
      async (uri?: vscode.Uri) => {
        logger.info("Command: uploadFile");

        if (!uri) {
          const activeEditor = vscode.window.activeTextEditor;
          if (!activeEditor) {
            vscode.window.showWarningMessage("No file selected to upload");
            return;
          }
          uri = activeEditor.document.uri;
        }

        if (!server.isRunning) {
          vscode.window.showWarningMessage(
            "Bridge server is not running. Start it first."
          );
          return;
        }

        await server.openInBrowser();
        vscode.window.showInformationMessage(
          `Ready to upload ${uri.fsPath}. Use the File Manager in the browser interface.`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.uploadProject", async () => {
      logger.info("Command: uploadProject");

      if (!server.isRunning) {
        vscode.window.showWarningMessage(
          "Bridge server is not running. Start it first."
        );
        return;
      }

      await server.openInBrowser();
      vscode.window.showInformationMessage(
        "Use the Sync feature in the browser interface to upload the project folder."
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.listFiles", async () => {
      logger.info("Command: listFiles");

      if (!server.isRunning) {
        vscode.window.showWarningMessage(
          "Bridge server is not running. Start it first."
        );
        return;
      }

      await server.openInBrowser();
      vscode.window.showInformationMessage(
        "Connect to device in browser to view files."
      );
    })
  );

  // REPL and device control commands
  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.openREPL", async () => {
      logger.info("Command: openREPL");

      if (!server.isRunning) {
        vscode.window.showWarningMessage(
          "Bridge server is not running. Start it first."
        );
        return;
      }

      await server.openInBrowser();
      vscode.window.showInformationMessage(
        "The REPL is available in the browser terminal."
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.softReset", async () => {
      logger.info("Command: softReset");

      if (!server.isRunning) {
        vscode.window.showWarningMessage(
          "Bridge server is not running. Start it first."
        );
        return;
      }

      await server.openInBrowser();
      vscode.window.showInformationMessage(
        "Use the Soft Reset button in the browser interface."
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.hardReset", async () => {
      logger.info("Command: hardReset");

      if (!server.isRunning) {
        vscode.window.showWarningMessage(
          "Bridge server is not running. Start it first."
        );
        return;
      }

      await server.openInBrowser();
      vscode.window.showInformationMessage(
        "Use the Hard Reset button in the browser interface."
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.stopCode", async () => {
      logger.info("Command: stopCode");

      if (!server.isRunning) {
        vscode.window.showWarningMessage(
          "Bridge server is not running. Start it first."
        );
        return;
      }

      await server.openInBrowser();
      vscode.window.showInformationMessage(
        "Use the Stop button in the browser interface."
      );
    })
  );

  // Tree view refresh
  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.refreshFiles", () => {
      logger.info("Command: refreshFiles");
      // This will be implemented when tree view is added
      vscode.window.showInformationMessage(
        "Files will be refreshed when device is connected."
      );
    })
  );

  // Project setup commands
  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.createProject", async () => {
      logger.info("Command: createProject");
      await createMicroPythonProject(context, logger);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "picoBridge.setupExistingProject",
      async () => {
        logger.info("Command: setupExistingProject");
        await setupExistingProject(logger);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "picoBridge.debugPythonFile",
      async (resource?: unknown) => {
        logger.info("Command: debugPythonFile");

        let targetUri = resolveUri(resource);
        if (!targetUri) {
          const editor = vscode.window.activeTextEditor;
          if (!editor || editor.document.languageId !== "python") {
            vscode.window.showWarningMessage(
              "Open a Python file to debug it in the emulator"
            );
            return;
          }
          if (editor.document.isUntitled) {
            vscode.window.showWarningMessage(
              "Save the Python file before debugging it in the emulator"
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
            "Only filesystem-based Python files can be debugged"
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
            "Save the Python file before debugging it in the emulator"
          );
          return;
        }

        if (document.isDirty) {
          await document.save();
        }

        const config = vscode.workspace.getConfiguration("picoBridge.emulator");
        const pythonExecutable = config.get<string>(
          "pythonExecutable",
          "python3"
        );
        const runnerPath = path.join(
          context.extensionPath,
          "emulator",
          "mock",
          "runner.py"
        );

        const debugConfiguration: vscode.DebugConfiguration = {
          name: "Pico Bridge: Debug Emulator",
          type: "python",
          request: "launch",
          program: runnerPath,
          args: [document.uri.fsPath],
          console: "integratedTerminal",
          justMyCode: false,
          cwd: path.dirname(document.uri.fsPath),
          python: pythonExecutable,
          env: {
            MICROPYTHON_MOCK: "1",
          },
        };

        const started = await vscode.debug.startDebugging(
          undefined,
          debugConfiguration
        );

        if (!started) {
          vscode.window.showErrorMessage(
            "Failed to start debugging session. Ensure the Python extension is installed."
          );
        }
      }
    )
  );

  logger.info("All commands registered");
}

/**
 * Create a new MicroPython project by copying the template
 */
async function createMicroPythonProject(
  _context: vscode.ExtensionContext,
  logger: Logger
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("No workspace folder open");
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Warn about overwriting
  const confirmation = await vscode.window.showWarningMessage(
    "This will copy the MicroPython project template to your workspace root. Any existing files with the same names will be overwritten.",
    { modal: true },
    "Continue",
    "Cancel"
  );

  if (confirmation !== "Continue") {
    return;
  }

  try {
    // Look for bundled project template inside the extension and fall back to legacy locations
    const candidateTemplatePaths: string[] = [
      path.join(_context.extensionPath, "project"),
      path.join(workspaceRoot, "project"),
      path.join(workspaceRoot, "..", "project"),
    ];

    const templateProjectPath = candidateTemplatePaths.find((candidate) =>
      fs.existsSync(candidate)
    );

    if (!templateProjectPath) {
      vscode.window.showErrorMessage(
        "Project template not found. Please ensure the project folder exists in the workspace."
      );
      return;
    }

    // Copy recursively
    await copyDirectory(templateProjectPath, workspaceRoot, logger);

    // Create .micropico marker
    const markerPath = path.join(workspaceRoot, ".micropico");
    fs.writeFileSync(
      markerPath,
      "This folder contains a MicroPython project\n"
    );

    logger.info("MicroPython project created successfully");
    vscode.window.showInformationMessage(
      "MicroPython project created! You can now start developing."
    );

    // Refresh workspace
    vscode.commands.executeCommand(
      "workbench.files.action.refreshFilesExplorer"
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to create project: ${errorMessage}`);
    vscode.window.showErrorMessage(`Failed to create project: ${errorMessage}`);
  }
}

/**
 * Setup an existing folder as a MicroPython project
 */
async function setupExistingProject(logger: Logger): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("No workspace folder open");
    return;
  }

  // Ask user to select a folder
  const folderUri = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Project Folder",
    defaultUri: workspaceFolders[0].uri,
    title: "Select the folder to setup as MicroPython project",
  });

  if (!folderUri || folderUri.length === 0) {
    return;
  }

  const selectedPath = folderUri[0].fsPath;

  try {
    // Create .micropico marker in selected folder
    const markerPath = path.join(selectedPath, ".micropico");
    fs.writeFileSync(
      markerPath,
      "This folder contains a MicroPython project\n"
    );

    logger.info(`Setup MicroPython project at: ${selectedPath}`);
    vscode.window.showInformationMessage(
      `Setup complete! "${path.basename(
        selectedPath
      )}" is now a MicroPython project.`
    );

    // Refresh workspace
    vscode.commands.executeCommand(
      "workbench.files.action.refreshFilesExplorer"
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to setup project: ${errorMessage}`);
    vscode.window.showErrorMessage(`Failed to setup project: ${errorMessage}`);
  }
}

/**
 * Recursively copy directory
 */
async function copyDirectory(
  source: string,
  destination: string,
  logger: Logger
): Promise<void> {
  // Create destination if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    // Skip certain directories
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "__pycache__"
      ) {
        continue;
      }
      await copyDirectory(sourcePath, destPath, logger);
    } else {
      fs.copyFileSync(sourcePath, destPath);
      logger.info(`Copied: ${entry.name}`);
    }
  }
}
