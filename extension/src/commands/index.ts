/**
 * Command Registrations for Pico Bridge Extension
 *
 * Registers all commands defined in package.json and wires them
 * to the appropriate functionality.
 */

import * as vscode from "vscode";
import { BridgeServer } from "../server";
import { Logger } from "../utils";

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
    const fs = require("fs");
    const path = require("path");

    // Find the actual template project folder
    let templateProjectPath = path.join(workspaceRoot, "project");
    if (!fs.existsSync(templateProjectPath)) {
      // Try parent directory (when running from extension folder)
      templateProjectPath = path.join(workspaceRoot, "..", "project");
      if (!fs.existsSync(templateProjectPath)) {
        vscode.window.showErrorMessage(
          "Project template not found. Please ensure the project folder exists in the workspace."
        );
        return;
      }
    }

    // Copy recursively
    await copyDirectory(fs, path, templateProjectPath, workspaceRoot, logger);

    // Create .micropython marker
    const markerPath = path.join(workspaceRoot, ".micropython");
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
    const fs = require("fs");
    const path = require("path");

    // Create .micropython marker in selected folder
    const markerPath = path.join(selectedPath, ".micropython");
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
  fs: any,
  path: any,
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
      await copyDirectory(fs, path, sourcePath, destPath, logger);
    } else {
      fs.copyFileSync(sourcePath, destPath);
      logger.info(`Copied: ${entry.name}`);
    }
  }
}
