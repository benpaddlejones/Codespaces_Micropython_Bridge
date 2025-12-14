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
import { Logger, resolveUri } from "../utils";

/**
 * Register all Pico Bridge commands with VS Code.
 *
 * This function registers command handlers for all commands defined in package.json,
 * including server lifecycle, file operations, project setup, and documentation commands.
 *
 * @param context - The extension context for registering disposables
 * @param server - The BridgeServer instance for server operations
 * @param logger - The Logger instance for command logging
 */
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

  // Tree view refresh - triggers refresh of device files in browser interface
  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.refreshFiles", () => {
      logger.info("Command: refreshFiles");
      // Device file listing is handled by the browser interface
      vscode.window.showInformationMessage(
        "Files will be refreshed when device is connected."
      );
    })
  );

  // Project setup commands
  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.createProject", async () => {
      logger.info("Command: createProject (Advanced)");
      await createAdvancedProject(context, logger);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "picoBridge.createBasicProject",
      async () => {
        logger.info("Command: createBasicProject");
        await createBasicProject(logger);
      }
    )
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

  // Add sample scripts command
  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.addSampleScripts", async () => {
      logger.info("Command: addSampleScripts");
      await addSampleScripts(context, logger);
    })
  );

  // View pinout command
  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.viewPinout", async () => {
      logger.info("Command: viewPinout");
      vscode.window.showInformationMessage(
        "Pinout diagrams are shown in the Emulator panel when you select a board type."
      );
    })
  );

  // Documentation commands - open external URLs
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "picoBridge.openMicroPythonDocs",
      async () => {
        logger.info("Command: openMicroPythonDocs");
        const url = vscode.Uri.parse("https://docs.micropython.org/en/latest/");
        await vscode.env.openExternal(url);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.openDebugpyDocs", async () => {
      logger.info("Command: openDebugpyDocs");
      const url = vscode.Uri.parse(
        "https://github.com/benpaddlejones/Codespaces_Micropython_Bridge#-debugpy-integration"
      );
      await vscode.env.openExternal(url);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("picoBridge.openEmulatorDocs", async () => {
      logger.info("Command: openEmulatorDocs");
      const url = vscode.Uri.parse(
        "https://github.com/benpaddlejones/Codespaces_Micropython_Bridge#-emulator-documentation"
      );
      await vscode.env.openExternal(url);
    })
  );

  logger.info("All commands registered");
}

/**
 * Get the next available project folder name.
 *
 * Finds a unique project folder name by checking for existing folders
 * named 'project', 'project1', 'project2', etc.
 *
 * @param workspaceRoot - The root path of the workspace to check
 * @returns A unique project folder name that doesn't exist yet
 */
function getNextProjectFolderName(workspaceRoot: string): string {
  let projectName = "project";
  let counter = 1;

  while (fs.existsSync(path.join(workspaceRoot, projectName))) {
    projectName = `project${counter}`;
    counter++;
  }

  return projectName;
}

/**
 * Create a basic MicroPython project structure.
 *
 * Creates a new project folder with:
 * - Empty `lib/` directory for libraries
 * - Starter `main.py` file
 * - `.micropico` marker file to identify as MicroPython project
 *
 * @param logger - Logger instance for status messages
 */
async function createBasicProject(logger: Logger): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("No workspace folder open");
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const projectName = getNextProjectFolderName(workspaceRoot);
  const projectPath = path.join(workspaceRoot, projectName);

  try {
    // Create project folder
    fs.mkdirSync(projectPath, { recursive: true });

    // Create empty lib folder
    fs.mkdirSync(path.join(projectPath, "lib"), { recursive: true });

    // Create empty main.py
    fs.writeFileSync(
      path.join(projectPath, "main.py"),
      "# MicroPython main.py\n# Write your code here\n\n"
    );

    // Create .micropico marker
    fs.writeFileSync(
      path.join(projectPath, ".micropico"),
      "This folder contains a MicroPython project\n"
    );

    logger.info(`Basic project created at: ${projectPath}`);
    vscode.window.showInformationMessage(
      `Basic project '${projectName}' created! Open main.py to start coding.`
    );

    // Refresh workspace
    vscode.commands.executeCommand(
      "workbench.files.action.refreshFilesExplorer"
    );

    // Open main.py
    const mainPyUri = vscode.Uri.file(path.join(projectPath, "main.py"));
    vscode.commands.executeCommand("vscode.open", mainPyUri);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to create basic project: ${errorMessage}`);
    vscode.window.showErrorMessage(
      `Failed to create basic project: ${errorMessage}`
    );
  }
}

/**
 * Create an advanced MicroPython project with debugging support.
 *
 * Creates a new project folder with:
 * - `lib/launcher/` directory with debugging utilities
 * - `py_scripts/` directory for user scripts
 * - `main.py` and `config.py` files
 * - `.micropico` marker file
 *
 * @param _context - Extension context (currently unused but available for future use)
 * @param logger - Logger instance for status messages
 */
async function createAdvancedProject(
  _context: vscode.ExtensionContext,
  logger: Logger
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("No workspace folder open");
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const projectName = getNextProjectFolderName(workspaceRoot);
  const projectPath = path.join(workspaceRoot, projectName);

  try {
    // Create project folder
    fs.mkdirSync(projectPath, { recursive: true });

    // Copy lib/launcher from workspace
    const libLauncherSource = path.join(workspaceRoot, "lib", "launcher");
    const libLauncherDest = path.join(projectPath, "lib", "launcher");
    if (fs.existsSync(libLauncherSource)) {
      await copyDirectory(libLauncherSource, libLauncherDest, logger);
    } else {
      // Fallback: create empty lib folder
      fs.mkdirSync(path.join(projectPath, "lib"), { recursive: true });
    }

    // Copy main.py from workspace root
    const mainPySource = path.join(workspaceRoot, "main.py");
    if (fs.existsSync(mainPySource)) {
      fs.copyFileSync(mainPySource, path.join(projectPath, "main.py"));
      logger.info("Copied main.py");
    } else {
      // Create default main.py
      fs.writeFileSync(
        path.join(projectPath, "main.py"),
        "# MicroPython main.py with advanced debugging\n# Write your code here\n\n"
      );
    }

    // Copy config.py from workspace root
    const configPySource = path.join(workspaceRoot, "config.py");
    if (fs.existsSync(configPySource)) {
      fs.copyFileSync(configPySource, path.join(projectPath, "config.py"));
      logger.info("Copied config.py");
    }

    // Create py_scripts folder with v01.py only
    const pyScriptsDir = path.join(projectPath, "py_scripts");
    fs.mkdirSync(pyScriptsDir, { recursive: true });

    const v01Source = path.join(workspaceRoot, "py_scripts", "v01.py");
    if (fs.existsSync(v01Source)) {
      fs.copyFileSync(v01Source, path.join(pyScriptsDir, "v01.py"));
      logger.info("Copied v01.py");
    }

    // Create .micropico marker
    fs.writeFileSync(
      path.join(projectPath, ".micropico"),
      "This folder contains a MicroPython project\n"
    );

    logger.info(`Advanced project created at: ${projectPath}`);
    vscode.window.showInformationMessage(
      `Advanced project '${projectName}' created with debugging support!`
    );

    // Refresh workspace
    vscode.commands.executeCommand(
      "workbench.files.action.refreshFilesExplorer"
    );

    // Open main.py
    const mainPyUri = vscode.Uri.file(path.join(projectPath, "main.py"));
    vscode.commands.executeCommand("vscode.open", mainPyUri);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to create advanced project: ${errorMessage}`);
    vscode.window.showErrorMessage(
      `Failed to create advanced project: ${errorMessage}`
    );
  }
}

/**
 * Configure an existing folder as a MicroPython project.
 *
 * Prompts the user to select a folder and adds the `.micropico` marker file
 * to identify it as a MicroPython project. This enables project-specific
 * features like file filtering and upload capabilities.
 *
 * @param logger - Logger instance for status messages
 */
async function setupExistingProject(logger: Logger): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("No workspace folder open");
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Ask user to select a folder (default to workspace root)
  const folderUri = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Project Folder",
    defaultUri: vscode.Uri.file(workspaceRoot),
    title:
      "Select folder to setup as MicroPython project (can select workspace root)",
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
 * Recursively copy a directory and its contents.
 *
 * Copies all files and subdirectories from source to destination,
 * automatically skipping common non-essential directories like
 * `node_modules`, `.git`, and `__pycache__`.
 *
 * @param source - The source directory path to copy from
 * @param destination - The destination directory path to copy to
 * @param logger - Logger instance for progress messages
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

/**
 * Add sample MicroPython scripts to the workspace.
 *
 * Creates a `sample-scripts` folder in the workspace and populates it
 * with example scripts for various board types (Pico, Pico W, ESP32).
 * Scripts are copied from the extension's bundled samples, with a
 * fallback to workspace directories for development mode.
 *
 * @param context - Extension context for accessing bundled resources
 * @param logger - Logger instance for status messages
 */
async function addSampleScripts(
  context: vscode.ExtensionContext,
  logger: Logger
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("No workspace folder open");
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const sampleScriptsDir = path.join(workspaceRoot, "sample-scripts");

  // Check if folder already exists
  if (fs.existsSync(sampleScriptsDir)) {
    const overwrite = await vscode.window.showWarningMessage(
      "The 'sample-scripts' folder already exists. Do you want to overwrite existing files?",
      { modal: true },
      "Overwrite",
      "Cancel"
    );
    if (overwrite !== "Overwrite") {
      return;
    }
  }

  try {
    // Create sample-scripts directory
    if (!fs.existsSync(sampleScriptsDir)) {
      fs.mkdirSync(sampleScriptsDir, { recursive: true });
    }

    // Sample scripts bundled with the extension
    // These are located in the extension's 'samples' folder
    const extensionSamplesDir = path.join(context.extensionPath, "samples");

    // List of sample scripts to copy
    const sampleFiles = [
      "pico_demo.py",
      "pico_w_demo.py",
      "pico2w_demo.py",
      "esp32_demo.py",
      "assembly_blink_explained.py",
      "plotter_demo.py",
    ];

    let copiedCount = 0;

    // Try to copy from extension's bundled samples first
    for (const fileName of sampleFiles) {
      const sourcePath = path.join(extensionSamplesDir, fileName);
      const destPath = path.join(sampleScriptsDir, fileName);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        logger.info(`Copied sample script: ${fileName}`);
        copiedCount++;
      }
    }

    // Fallback: Try copying from workspace root directories if extension samples not found
    // This supports development mode where samples may not be bundled yet
    if (copiedCount === 0) {
      const workspaceFallbackPaths = [
        {
          dir: "emulator-demos",
          files: [
            "pico_demo.py",
            "pico_w_demo.py",
            "pico2w_demo.py",
            "esp32_demo.py",
          ],
        },
        {
          dir: "py_scripts",
          files: ["assembly_blink_explained.py", "plotter_demo.py"],
        },
      ];

      for (const { dir, files } of workspaceFallbackPaths) {
        for (const fileName of files) {
          // Try from workspace root (development mode)
          const sourcePath = path.join(workspaceRoot, dir, fileName);
          const destPath = path.join(sampleScriptsDir, fileName);

          if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, destPath);
            logger.info(`Copied sample script (from workspace): ${fileName}`);
            copiedCount++;
          }
        }
      }
    }

    if (copiedCount === 0) {
      vscode.window.showWarningMessage(
        "No sample scripts were found. Sample scripts may not be bundled with this version."
      );
      return;
    }

    logger.info(`Added ${copiedCount} sample scripts to sample-scripts folder`);
    vscode.window.showInformationMessage(
      `Added ${copiedCount} sample scripts to 'sample-scripts' folder!`
    );

    // Refresh file explorer
    vscode.commands.executeCommand(
      "workbench.files.action.refreshFilesExplorer"
    );

    // Open the folder in explorer
    const folderUri = vscode.Uri.file(sampleScriptsDir);
    vscode.commands.executeCommand("revealInExplorer", folderUri);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to add sample scripts: ${errorMessage}`);
    vscode.window.showErrorMessage(
      `Failed to add sample scripts: ${errorMessage}`
    );
  }
}
