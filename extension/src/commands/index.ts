/**
 * Command Registrations for Pico Bridge Extension
 * 
 * Registers all commands defined in package.json and wires them
 * to the appropriate functionality.
 */

import * as vscode from 'vscode';
import { BridgeServer } from '../server';
import { Logger } from '../utils';

export function registerCommands(
    context: vscode.ExtensionContext,
    server: BridgeServer,
    logger: Logger
): void {
    // Server lifecycle commands
    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.startServer', async () => {
            logger.info('Command: startServer');
            await server.start();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.stopServer', async () => {
            logger.info('Command: stopServer');
            await server.stop();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.openBrowser', async () => {
            logger.info('Command: openBrowser');
            await server.openInBrowser();
        })
    );

    // Show logs command
    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.showLogs', () => {
            logger.info('Command: showLogs');
            logger.show();
        })
    );

    // File operations - these send messages via WebSocket to the bridge UI
    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.runFile', async (uri?: vscode.Uri) => {
            logger.info('Command: runFile');
            
            // Get active file if no URI provided
            if (!uri) {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('No file selected to run');
                    return;
                }
                uri = activeEditor.document.uri;
            }

            if (!server.isRunning) {
                const start = await vscode.window.showInformationMessage(
                    'Bridge server is not running. Start it first?',
                    'Start Server'
                );
                if (start === 'Start Server') {
                    await server.start();
                } else {
                    return;
                }
            }

            // Open browser to run the file
            // The bridge UI handles file execution
            await server.openInBrowser();
            vscode.window.showInformationMessage(`Ready to run ${uri.fsPath}. Connect to device in browser and use the Run button.`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.uploadFile', async (uri?: vscode.Uri) => {
            logger.info('Command: uploadFile');
            
            if (!uri) {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('No file selected to upload');
                    return;
                }
                uri = activeEditor.document.uri;
            }

            if (!server.isRunning) {
                vscode.window.showWarningMessage('Bridge server is not running. Start it first.');
                return;
            }

            await server.openInBrowser();
            vscode.window.showInformationMessage(`Ready to upload ${uri.fsPath}. Use the File Manager in the browser interface.`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.uploadProject', async () => {
            logger.info('Command: uploadProject');

            if (!server.isRunning) {
                vscode.window.showWarningMessage('Bridge server is not running. Start it first.');
                return;
            }

            await server.openInBrowser();
            vscode.window.showInformationMessage('Use the Sync feature in the browser interface to upload the project folder.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.listFiles', async () => {
            logger.info('Command: listFiles');

            if (!server.isRunning) {
                vscode.window.showWarningMessage('Bridge server is not running. Start it first.');
                return;
            }

            await server.openInBrowser();
            vscode.window.showInformationMessage('Connect to device in browser to view files.');
        })
    );

    // REPL and device control commands
    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.openREPL', async () => {
            logger.info('Command: openREPL');

            if (!server.isRunning) {
                vscode.window.showWarningMessage('Bridge server is not running. Start it first.');
                return;
            }

            await server.openInBrowser();
            vscode.window.showInformationMessage('The REPL is available in the browser terminal.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.softReset', async () => {
            logger.info('Command: softReset');

            if (!server.isRunning) {
                vscode.window.showWarningMessage('Bridge server is not running. Start it first.');
                return;
            }

            await server.openInBrowser();
            vscode.window.showInformationMessage('Use the Soft Reset button in the browser interface.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.hardReset', async () => {
            logger.info('Command: hardReset');

            if (!server.isRunning) {
                vscode.window.showWarningMessage('Bridge server is not running. Start it first.');
                return;
            }

            await server.openInBrowser();
            vscode.window.showInformationMessage('Use the Hard Reset button in the browser interface.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.stopCode', async () => {
            logger.info('Command: stopCode');

            if (!server.isRunning) {
                vscode.window.showWarningMessage('Bridge server is not running. Start it first.');
                return;
            }

            await server.openInBrowser();
            vscode.window.showInformationMessage('Use the Stop button in the browser interface.');
        })
    );

    // Tree view refresh
    context.subscriptions.push(
        vscode.commands.registerCommand('picoBridge.refreshFiles', () => {
            logger.info('Command: refreshFiles');
            // This will be implemented when tree view is added
            vscode.window.showInformationMessage('Files will be refreshed when device is connected.');
        })
    );

    logger.info('All commands registered');
}
