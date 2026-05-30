/**
 * Pico Bridge VS Code Extension
 *
 * Main entry point for the extension.
 *
 * This extension provides MicroPython development support for
 * Raspberry Pi Pico and ESP32 devices in GitHub Codespaces.
 *
 * CRITICAL ARCHITECTURE NOTE:
 * The bridge web interface MUST open in an external browser (NOT a webview)
 * because it requires the Web Serial API, which is not available in
 * VS Code webviews.
 */

import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { configurePylanceForMock, EmulatorManager } from "./emulator";
import { BridgeServer } from "./server";
import { Logger, resolvePythonExecutableOrWarn } from "./utils";
import {
  BridgeToolsProvider,
  StatusViewProvider,
  WorkspaceFilesWebviewProvider,
} from "./views";

import * as fs from "fs";
import * as path from "path";

/** Default debug configuration for MicroPython Emulator */
const DEFAULT_DEBUG_CONFIG: vscode.DebugConfiguration = {
  name: "MicroPython (Emulator)",
  type: "micropython-emulator",
  request: "launch",
  program: "${file}",
};

// Global instances
let logger: Logger | undefined;
let server: BridgeServer | undefined;
let emulatorManager: EmulatorManager | undefined;

/**
 * Called when the extension is activated
 */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  // Initialize logger
  logger = new Logger("Pico Bridge");
  context.subscriptions.push(logger);

  logger.info("Activating Pico Bridge extension...");
  logger.info(`Extension path: ${context.extensionPath}`);
  logger.info(`Storage path: ${context.globalStorageUri.fsPath}`);

  try {
    // Initialize the bridge server manager
    server = new BridgeServer(context, logger);
    context.subscriptions.push(server);

    // Register all commands
    registerCommands(context, server, logger);

    // Initialize emulator manager
    emulatorManager = new EmulatorManager(context, logger);
    emulatorManager.registerCommands();
    context.subscriptions.push({
      dispose: () => {
        emulatorManager?.dispose();
      },
    });

    // Auto-configure Pylance for MicroPython mock modules
    // This enables IntelliSense for `import machine`, `import utime`, etc.
    // Fire-and-forget: writing to workspace config can be slow on first install
    // and we don't want to block activation on it.
    void configurePylanceForMock(context, logger).catch((err) => {
      logger?.error(
        `configurePylanceForMock failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    // Auto-create .vscode/launch.json for debugpy if it doesn't exist.
    // Fire-and-forget: file I/O + JSON parsing shouldn't block activation.
    void ensureLaunchJson(context, logger).catch((err) => {
      logger?.error(
        `ensureLaunchJson failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    // Register debug configuration provider for MicroPython Emulator
    // This makes "MicroPython (Emulator)" appear in the debug dropdown
    const debugProvider = vscode.debug.registerDebugConfigurationProvider(
      "micropython-emulator",
      {
        // Provide initial configurations when user has no launch.json
        provideDebugConfigurations(
          _folder: vscode.WorkspaceFolder | undefined,
        ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
          return [{ ...DEFAULT_DEBUG_CONFIG }];
        },

        // Resolve the configuration before debugging starts
        async resolveDebugConfiguration(
          _folder: vscode.WorkspaceFolder | undefined,
          config: vscode.DebugConfiguration,
        ): Promise<vscode.DebugConfiguration | null | undefined> {
          // If no program specified, use current file
          if (!config.program) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === "python") {
              config.program = editor.document.uri.fsPath;
            }
          }

          const runnerPath = path.join(
            context.extensionPath,
            "emulator",
            "mock",
            "runner.py",
          );

          const resource = config.program
            ? vscode.Uri.file(config.program)
            : undefined;
          const pythonExecutable =
            await resolvePythonExecutableOrWarn(resource);
          if (!pythonExecutable) {
            // User has been shown an actionable error; abort silently.
            return undefined;
          }

          return {
            name: config.name || "MicroPython (Emulator)",
            type: "debugpy",
            request: "launch",
            program: runnerPath,
            args: [config.program],
            console: "integratedTerminal",
            justMyCode: false,
            cwd: config.program ? path.dirname(config.program) : undefined,
            python: pythonExecutable,
            env: {
              MICROPYTHON_MOCK: "1",
            },
          };
        },
      },
    );
    context.subscriptions.push(debugProvider);

    // Register as Initial provider - this makes it the DEFAULT when pressing F5
    const initialDebugProvider =
      vscode.debug.registerDebugConfigurationProvider(
        "micropython-emulator",
        {
          provideDebugConfigurations(
            _folder: vscode.WorkspaceFolder | undefined,
          ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
            return [{ ...DEFAULT_DEBUG_CONFIG }];
          },
        },
        vscode.DebugConfigurationProviderTriggerKind.Initial,
      );
    context.subscriptions.push(initialDebugProvider);

    // Also register as a dynamic provider so it shows in "Add Configuration..."
    const dynamicDebugProvider =
      vscode.debug.registerDebugConfigurationProvider(
        "micropython-emulator",
        {
          provideDebugConfigurations(
            _folder: vscode.WorkspaceFolder | undefined,
          ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
            return [{ ...DEFAULT_DEBUG_CONFIG }];
          },
        },
        vscode.DebugConfigurationProviderTriggerKind.Dynamic,
      );
    context.subscriptions.push(dynamicDebugProvider);

    // Register tree view providers with proper disposal
    const statusProvider = new StatusViewProvider(server);
    context.subscriptions.push(statusProvider);
    vscode.window.registerTreeDataProvider("picoBridge.status", statusProvider);

    const workspaceFilesProvider = new WorkspaceFilesWebviewProvider(
      context,
      server,
    );
    context.subscriptions.push(workspaceFilesProvider);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "picoBridge.workspaceFiles",
        workspaceFilesProvider,
        { webviewOptions: { retainContextWhenHidden: true } },
      ),
    );

    // Register bridge tools provider
    const bridgeToolsProvider = new BridgeToolsProvider();
    context.subscriptions.push(bridgeToolsProvider);
    vscode.window.registerTreeDataProvider(
      "picoBridge.deviceExplorer",
      bridgeToolsProvider,
    );

    // Register refresh command for workspace files
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "picoBridge.refreshWorkspaceFiles",
        () => {
          workspaceFilesProvider.refresh();
        },
      ),
    );

    // Set initial context values (fire-and-forget; not needed for activation)
    void vscode.commands.executeCommand(
      "setContext",
      "picoBridge.serverRunning",
      false,
    );

    // Check if we should auto-start (using correct config key: server.autoStart)
    const config = vscode.workspace.getConfiguration("picoBridge");
    if (config.get<boolean>("server.autoStart", false)) {
      logger.info("Auto-starting bridge server...");
      // Delay auto-start slightly to let VS Code fully load
      const autoStartTimer = setTimeout(async () => {
        try {
          if (server) {
            await server.start();
            if (config.get<boolean>("server.openBrowserOnStart", true)) {
              await server.openInBrowser();
            }
          }
        } catch (error) {
          logger?.error(
            "Auto-start failed: " +
              (error instanceof Error ? error.message : String(error)),
          );
        }
      }, 2000);

      // Ensure timer is cleared on deactivation
      context.subscriptions.push({
        dispose: () => clearTimeout(autoStartTimer),
      });
    }

    logger.info("Pico Bridge extension activated successfully");

    // Show welcome message on first activation.
    // Fire-and-forget so the modal dialog doesn't keep activation in the
    // "loading" state until the user clicks something — that's the main
    // reason the extension felt laggy on first install.
    const hasShownWelcome = context.globalState.get<boolean>(
      "hasShownWelcome",
      false,
    );
    if (!hasShownWelcome) {
      void (async () => {
        const selection = await vscode.window.showInformationMessage(
          "Welcome to Pico Bridge! This extension enables MicroPython development for Raspberry Pi Pico and ESP32.",
          "Start Server",
          "Open Walkthrough",
          "Dismiss",
        );

        if (selection === "Start Server") {
          await vscode.commands.executeCommand("picoBridge.startServer");
        } else if (selection === "Open Walkthrough") {
          const readmeUri = vscode.Uri.joinPath(
            context.extensionUri,
            "README.md",
          );
          await vscode.commands.executeCommand("vscode.open", readmeUri);
        }

        await context.globalState.update("hasShownWelcome", true);
      })();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Failed to activate extension: ${errorMessage}`);
    vscode.window.showErrorMessage(
      `Pico Bridge failed to activate: ${errorMessage}`,
    );
    throw error;
  }
}

/**
 * Ensure .vscode/launch.json exists with debugpy configuration.
 * This is called on extension activation to make the workspace debug-ready.
 */
async function ensureLaunchJson(
  _context: vscode.ExtensionContext,
  logger: Logger,
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    logger.info("No workspace folder - skipping launch.json creation");
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const vscodeDir = path.join(workspaceRoot, ".vscode");
  const launchJsonPath = path.join(vscodeDir, "launch.json");

  // Check if launch.json already exists
  if (fs.existsSync(launchJsonPath)) {
    logger.info("launch.json already exists - checking for MicroPython config");

    try {
      const content = fs.readFileSync(launchJsonPath, "utf8");

      // Already has our config using the correct type — nothing to do.
      if (content.includes('"micropython-emulator"')) {
        logger.info("MicroPython debug configuration already present");
        return;
      }

      // Has the old-style debugpy+hardcoded-path config written by an earlier
      // version of the extension — update it to the new form in-place.

      // Parse existing launch.json (JSONC format — may contain comments)
      // Use a state-aware approach to strip comments only outside strings
      let jsonContent = "";
      let inString = false;
      let escape = false;
      for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (escape) {
          jsonContent += ch;
          escape = false;
          continue;
        }
        if (inString) {
          if (ch === "\\") {
            escape = true;
          } else if (ch === '"') {
            inString = false;
          }
          jsonContent += ch;
          continue;
        }
        // Outside string
        if (ch === '"') {
          inString = true;
          jsonContent += ch;
        } else if (ch === "/" && content[i + 1] === "/") {
          // Skip single-line comment
          while (i < content.length && content[i] !== "\n") {
            i++;
          }
          jsonContent += "\n";
        } else if (ch === "/" && content[i + 1] === "*") {
          // Skip block comment
          i += 2;
          while (
            i < content.length - 1 &&
            !(content[i] === "*" && content[i + 1] === "/")
          ) {
            i++;
          }
          i++; // skip closing '/'
        } else {
          jsonContent += ch;
        }
      }
      const launchConfig = JSON.parse(jsonContent);

      const micropythonConfig = {
        name: "MicroPython (Emulator)",
        type: "micropython-emulator",
        request: "launch",
        program: "${file}",
      };

      launchConfig.configurations = launchConfig.configurations || [];
      // Replace any stale debugpy+hardcoded-runner entry if present
      launchConfig.configurations = launchConfig.configurations.filter(
        (c: { name?: string }) => c.name !== "MicroPython (Emulator)",
      );
      launchConfig.configurations.unshift(micropythonConfig);

      fs.writeFileSync(launchJsonPath, JSON.stringify(launchConfig, null, 4));
      logger.info(
        "Added MicroPython debug configuration to existing launch.json",
      );
    } catch (error) {
      logger.warn(
        "Could not modify existing launch.json: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
    return;
  }

  // Create .vscode directory if it doesn't exist
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }

  // Create launch.json with our debug configuration
  const launchConfig = {
    version: "0.2.0",
    configurations: [
      {
        name: "MicroPython (Emulator)",
        type: "micropython-emulator",
        request: "launch",
        program: "${file}",
      },
      {
        name: "Python: Current File",
        type: "debugpy",
        request: "launch",
        program: "${file}",
        console: "integratedTerminal",
      },
    ],
  };

  fs.writeFileSync(launchJsonPath, JSON.stringify(launchConfig, null, 4));
  logger.info(
    "Created .vscode/launch.json with MicroPython debug configuration",
  );
}

/**
 * Called when the extension is deactivated
 */
export async function deactivate(): Promise<void> {
  logger?.info("Deactivating Pico Bridge extension...");

  // Stop the server if running - use try/catch to ensure clean deactivation
  try {
    if (server?.isRunning) {
      await server.stop();
    }
    emulatorManager?.dispose();
  } catch (error) {
    // Log but don't throw during deactivation
    logger?.error(
      "Error stopping server during deactivation: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }

  logger?.info("Pico Bridge extension deactivated");

  // Clear references
  server = undefined;
  logger = undefined;
}
