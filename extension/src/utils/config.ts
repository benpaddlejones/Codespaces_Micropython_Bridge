/**
 * Configuration utility for Pico Bridge extension
 * Provides typed access to VS Code settings
 */

import * as vscode from 'vscode';
import { PicoBridgeConfig } from '../types';

/**
 * Get the current extension configuration
 */
export function getConfig(): PicoBridgeConfig {
    const config = vscode.workspace.getConfiguration('picoBridge');

    return {
        server: {
            port: config.get<number>('server.port', 3000),
            autoStart: config.get<boolean>('server.autoStart', false)
        },
        serial: {
            baudRate: config.get<number>('serial.baudRate', 115200)
        },
        pty: {
            linkPath: config.get<string>('pty.linkPath', '/tmp/picoUSB')
        },
        ui: {
            showTimestamps: config.get<boolean>('ui.showTimestamps', false)
        },
        project: {
            excludeFolders: config.get<string[]>('project.excludeFolders', ['examples', '.git', '__pycache__', 'node_modules'])
        },
        browser: {
            customCommand: config.get<string>('browser.customCommand', '')
        }
    };
}

/**
 * Update a configuration value
 */
export async function updateConfig<T>(key: string, value: T, global: boolean = false): Promise<void> {
    const config = vscode.workspace.getConfiguration('picoBridge');
    await config.update(key, value, global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace);
}

/**
 * Listen for configuration changes
 */
export function onConfigChange(callback: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('picoBridge')) {
            callback(e);
        }
    });
}
