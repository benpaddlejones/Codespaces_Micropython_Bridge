/**
 * Logger utility for Pico Bridge extension
 * Uses VS Code Output Channel for logging
 */

import * as vscode from 'vscode';

export class Logger implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private static instance: Logger | undefined;

    constructor(name: string) {
        this.outputChannel = vscode.window.createOutputChannel(name);
    }

    /**
     * Get singleton instance
     */
    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger('Pico Bridge');
        }
        return Logger.instance;
    }

    /**
     * Log info message
     */
    info(message: string): void {
        this.log('INFO', message);
    }

    /**
     * Log warning message
     */
    warn(message: string): void {
        this.log('WARN', message);
    }

    /**
     * Log error message
     */
    error(message: string | Error): void {
        const msg = message instanceof Error ? message.message : message;
        this.log('ERROR', msg);
    }

    /**
     * Log debug message
     */
    debug(message: string): void {
        this.log('DEBUG', message);
    }

    /**
     * Internal log method with timestamp and level
     */
    private log(level: string, message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`);
    }

    /**
     * Show the output channel
     */
    show(): void {
        this.outputChannel.show(true);
    }

    /**
     * Clear the output channel
     */
    clear(): void {
        this.outputChannel.clear();
    }

    /**
     * Dispose the output channel
     */
    dispose(): void {
        this.outputChannel.dispose();
        Logger.instance = undefined;
    }
}
