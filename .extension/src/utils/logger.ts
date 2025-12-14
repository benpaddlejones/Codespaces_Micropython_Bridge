/**
 * Logger utility for Pico Bridge extension
 *
 * Provides structured logging to a VS Code Output Channel.
 */

import * as vscode from "vscode";

/**
 * Logger class that wraps a VS Code Output Channel.
 *
 * Provides info, warn, error, and debug logging methods with
 * automatic timestamping and log level prefixes.
 *
 * @example
 * const logger = new Logger('My Extension');
 * logger.info('Extension started');
 * logger.error('Something went wrong');
 */
export class Logger implements vscode.Disposable {
  private outputChannel: vscode.OutputChannel;

  /**
   * Create a new Logger instance.
   *
   * @param name - The name for the output channel
   */
  constructor(name: string) {
    this.outputChannel = vscode.window.createOutputChannel(name);
  }

  /**
   * Log an informational message.
   *
   * @param message - The message to log
   */
  info(message: string): void {
    this.log("INFO", message);
  }

  /**
   * Log a warning message.
   *
   * @param message - The message to log
   */
  warn(message: string): void {
    this.log("WARN", message);
  }

  /**
   * Log an error message.
   *
   * @param message - The error message or Error object to log
   */
  error(message: string | Error): void {
    const msg = message instanceof Error ? message.message : message;
    this.log("ERROR", msg);
  }

  /**
   * Log a debug message.
   *
   * Debug messages are useful during development but may be
   * too verbose for production use.
   *
   * @param message - The message to log
   */
  debug(message: string): void {
    this.log("DEBUG", message);
  }

  /**
   * Internal log method with timestamp and level formatting.
   *
   * @param level - The log level (INFO, WARN, ERROR, DEBUG)
   * @param message - The message to log
   */
  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`);
  }

  /**
   * Show the output channel in the VS Code panel.
   */
  show(): void {
    this.outputChannel.show(true);
  }

  /**
   * Clear all content from the output channel.
   */
  clear(): void {
    this.outputChannel.clear();
  }

  /**
   * Dispose the output channel and release resources.
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}
