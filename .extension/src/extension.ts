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
import { BridgeServer } from "./server";
import { Logger } from "./utils";
import { StatusViewProvider, WorkspaceFilesProvider } from "./views";

// Global instances
let logger: Logger | undefined;
let server: BridgeServer | undefined;

/**
 * Called when the extension is activated
 */
export async function activate(
  context: vscode.ExtensionContext
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

    // Register tree view providers with proper disposal
    const statusProvider = new StatusViewProvider(server);
    context.subscriptions.push(statusProvider);
    vscode.window.registerTreeDataProvider("picoBridge.status", statusProvider);

    const workspaceFilesProvider = new WorkspaceFilesProvider();
    context.subscriptions.push(workspaceFilesProvider);
    vscode.window.registerTreeDataProvider(
      "picoBridge.workspaceFiles",
      workspaceFilesProvider
    );

    // Register refresh command for workspace files
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "picoBridge.refreshWorkspaceFiles",
        () => {
          workspaceFilesProvider.refresh();
        }
      )
    );

    // Set initial context values
    await vscode.commands.executeCommand(
      "setContext",
      "picoBridge.serverRunning",
      false
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
              (error instanceof Error ? error.message : String(error))
          );
        }
      }, 2000);

      // Ensure timer is cleared on deactivation
      context.subscriptions.push({
        dispose: () => clearTimeout(autoStartTimer),
      });
    }

    logger.info("Pico Bridge extension activated successfully");

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get<boolean>(
      "hasShownWelcome",
      false
    );
    if (!hasShownWelcome) {
      const selection = await vscode.window.showInformationMessage(
        "Welcome to Pico Bridge! This extension enables MicroPython development for Raspberry Pi Pico and ESP32.",
        "Start Server",
        "Open Walkthrough",
        "Dismiss"
      );

      if (selection === "Start Server") {
        await vscode.commands.executeCommand("picoBridge.startServer");
      } else if (selection === "Open Walkthrough") {
        // Use correct walkthrough ID from package.json
        await vscode.commands.executeCommand(
          "workbench.action.openWalkthrough",
          "benpaddlejones.pico-bridge#picoBridge.gettingStarted"
        );
      }

      await context.globalState.update("hasShownWelcome", true);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Failed to activate extension: ${errorMessage}`);
    vscode.window.showErrorMessage(
      `Pico Bridge failed to activate: ${errorMessage}`
    );
    throw error;
  }
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
  } catch (error) {
    // Log but don't throw during deactivation
    logger?.error(
      "Error stopping server during deactivation: " +
        (error instanceof Error ? error.message : String(error))
    );
  }

  logger?.info("Pico Bridge extension deactivated");

  // Clear references
  server = undefined;
  logger = undefined;
}
