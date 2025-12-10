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

import * as vscode from 'vscode';
import { Logger } from './utils';
import { BridgeServer } from './server';
import { registerCommands } from './commands';
import { StatusViewProvider, WorkspaceFilesProvider } from './views';

// Global instances
let logger: Logger;
let server: BridgeServer;

/**
 * Called when the extension is activated
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize logger
    logger = new Logger('Pico Bridge');
    context.subscriptions.push(logger);

    logger.info('Activating Pico Bridge extension...');
    logger.info(`Extension path: ${context.extensionPath}`);
    logger.info(`Storage path: ${context.globalStorageUri.fsPath}`);

    try {
        // Initialize the bridge server manager
        server = new BridgeServer(context, logger);
        context.subscriptions.push(server);

        // Register all commands
        registerCommands(context, server, logger);

        // Register tree view providers
        const statusProvider = new StatusViewProvider(server);
        vscode.window.registerTreeDataProvider('picoBridge.status', statusProvider);

        const workspaceFilesProvider = new WorkspaceFilesProvider();
        vscode.window.registerTreeDataProvider('picoBridge.workspaceFiles', workspaceFilesProvider);

        // Register refresh command for workspace files
        context.subscriptions.push(
            vscode.commands.registerCommand('picoBridge.refreshWorkspaceFiles', () => {
                workspaceFilesProvider.refresh();
            })
        );

        // Set initial context values
        vscode.commands.executeCommand('setContext', 'picoBridge.serverRunning', false);

        // Check if we should auto-start
        const config = vscode.workspace.getConfiguration('picoBridge');
        if (config.get<boolean>('autoStart', false)) {
            logger.info('Auto-starting bridge server...');
            // Delay auto-start slightly to let VS Code fully load
            setTimeout(async () => {
                try {
                    await server.start();
                    if (config.get<boolean>('openBrowserOnStart', true)) {
                        await server.openInBrowser();
                    }
                } catch (error) {
                    logger.error('Auto-start failed: ' + (error instanceof Error ? error.message : String(error)));
                }
            }, 2000);
        }

        logger.info('Pico Bridge extension activated successfully');

        // Show welcome message on first activation
        const hasShownWelcome = context.globalState.get<boolean>('hasShownWelcome', false);
        if (!hasShownWelcome) {
            const selection = await vscode.window.showInformationMessage(
                'Welcome to Pico Bridge! This extension enables MicroPython development for Raspberry Pi Pico and ESP32.',
                'Start Server',
                'Open Walkthrough',
                'Dismiss'
            );

            if (selection === 'Start Server') {
                await vscode.commands.executeCommand('picoBridge.startServer');
            } else if (selection === 'Open Walkthrough') {
                await vscode.commands.executeCommand('workbench.action.openWalkthrough', 'pico-bridge.pico-bridge#picoBridge.welcome');
            }

            await context.globalState.update('hasShownWelcome', true);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to activate extension: ${errorMessage}`);
        vscode.window.showErrorMessage(`Pico Bridge failed to activate: ${errorMessage}`);
        throw error;
    }
}

/**
 * Called when the extension is deactivated
 */
export function deactivate(): void {
    logger?.info('Deactivating Pico Bridge extension...');
    
    // Stop the server if running
    if (server?.isRunning) {
        server.stop();
    }
    
    logger?.info('Pico Bridge extension deactivated');
}
