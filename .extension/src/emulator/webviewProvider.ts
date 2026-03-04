import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { Logger } from "../utils";

/** Callback type for handling messages received from the emulator webview. */
type PanelMessageHandler = (message: unknown) => void;

/**
 * Manages the MicroPython Emulator webview panel.
 *
 * This class handles creating, showing, and communicating with the
 * emulator webview that displays the virtual board and its state.
 */
export class EmulatorWebview implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private currentBoard: string = "pico";

  /**
   * Create a new EmulatorWebview instance.
   *
   * @param context - The extension context for resource paths
   * @param logger - Logger instance for debugging
   * @param onMessage - Callback for handling messages from the webview
   */
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger,
    private readonly onMessage: PanelMessageHandler,
  ) {}

  /**
   * Show the emulator webview panel.
   *
   * If the panel already exists it is revealed; otherwise a new panel
   * is created with scripts enabled and content-security-policy applied.
   */
  public show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "picoBridge.emulator",
      "MicroPython Emulator",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, "emulator")),
        ],
      },
    );

    this.panel.webview.html = this.getHtml(this.panel.webview);
    this.panel.webview.onDidReceiveMessage((message) => {
      this.handleWebviewMessage(message);
      this.onMessage(message);
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.logger.info("Emulator webview opened");
  }

  /**
   * Handle an incoming message from the webview.
   *
   * Responds to `ready`, `board_change`, and `request_pinout` messages
   * by sending the appropriate SVG content back to the webview.
   *
   * @param message - The raw message object from the webview
   */
  private handleWebviewMessage(message: unknown): void {
    if (!message || typeof message !== "object") {
      return;
    }

    const msg = message as { type: string; board?: string };

    switch (msg.type) {
      case "ready":
        // Send initial board SVG
        this.sendBoardSvg(this.currentBoard);
        break;

      case "board_change":
        if (msg.board) {
          this.currentBoard = msg.board;
          this.sendBoardSvg(msg.board);
        }
        break;

      case "request_pinout":
        if (msg.board) {
          this.sendPinoutSvg(msg.board);
        }
        break;
    }
  }

  /**
   * Send the board SVG graphic to the webview.
   *
   * Falls back to a simple placeholder SVG if the file is not found.
   *
   * @param board - The board identifier (e.g. 'pico', 'pico-w', 'esp32')
   */
  private sendBoardSvg(board: string): void {
    const svgPath = this.getBoardSvgPath(board);
    if (fs.existsSync(svgPath)) {
      const svgContent = fs.readFileSync(svgPath, "utf8");
      this.postMessage({ type: "init", boardSvg: svgContent });
    } else {
      this.logger.warn(`Board SVG not found: ${svgPath}`);
      this.postMessage({
        type: "init",
        boardSvg: `<svg viewBox="0 0 200 100"><text x="100" y="50" text-anchor="middle" fill="#888">Board: ${board}</text></svg>`,
      });
    }
  }

  /**
   * Send the pinout reference SVG to the webview.
   *
   * Sends `null` if no pinout SVG exists for the requested board.
   *
   * @param board - The board identifier
   */
  private sendPinoutSvg(board: string): void {
    const svgPath = this.getPinoutSvgPath(board);
    if (fs.existsSync(svgPath)) {
      const svgContent = fs.readFileSync(svgPath, "utf8");
      this.postMessage({ type: "pinout_svg", svg: svgContent });
    } else {
      this.logger.warn(`Pinout SVG not found: ${svgPath}`);
      this.postMessage({ type: "pinout_svg", svg: null });
    }
  }

  /**
   * Resolve the filesystem path for a board's SVG file.
   *
   * @param board - The board identifier
   * @returns Absolute path to the board SVG file
   */
  private getBoardSvgPath(board: string): string {
    const webviewRoot = path.join(
      this.context.extensionPath,
      "emulator",
      "webview",
    );
    const boardFile = `board-${board}.svg`;
    return path.join(webviewRoot, boardFile);
  }

  /**
   * Resolve the filesystem path for a board's pinout SVG file.
   *
   * @param board - The board identifier
   * @returns Absolute path to the pinout SVG file
   */
  private getPinoutSvgPath(board: string): string {
    const pinoutsRoot = path.join(
      this.context.extensionPath,
      "media",
      "pinouts",
    );
    // Map board names to pinout files
    const pinoutMap: Record<string, string> = {
      pico: "pico-pinout.svg",
      "pico-w": "pico-pinout.svg", // Pico W uses same pinout as Pico
      pico2w: "pico-pinout.svg", // Pico 2 W uses same pinout layout
      esp32: "esp32-pinout.svg",
    };
    const pinoutFile = pinoutMap[board] || "pico-pinout.svg";
    return path.join(pinoutsRoot, pinoutFile);
  }

  /**
   * Get the currently selected board type.
   *
   * @returns The current board type (e.g., 'pico', 'pico-w', 'esp32')
   */
  public getCurrentBoard(): string {
    return this.currentBoard;
  }

  /**
   * Post a message to the webview panel.
   *
   * @param message - The message to send to the webview
   */
  public postMessage(message: unknown): void {
    if (!this.panel) {
      return;
    }
    this.panel.webview.postMessage(message);
  }

  /**
   * Generate the full HTML content for the emulator webview.
   *
   * Reads the HTML template from disk, injects CSP-compliant nonces,
   * converts local file paths to webview URIs, and applies the
   * content security policy.
   *
   * @param webview - The webview instance to generate URIs for
   * @returns The complete HTML string ready for rendering
   */
  private getHtml(webview: vscode.Webview): string {
    const webviewRoot = path.join(
      this.context.extensionPath,
      "emulator",
      "webview",
    );
    const htmlPath = path.join(webviewRoot, "index.html");
    const stylePath = path.join(webviewRoot, "style.css");
    const scriptPath = path.join(webviewRoot, "js", "main.js");

    const htmlTemplate = fs.readFileSync(htmlPath, "utf8");
    const nonce = crypto.randomBytes(16).toString("base64");

    const styleUri = webview
      .asWebviewUri(vscode.Uri.file(stylePath))
      .toString();
    const scriptUri = webview
      .asWebviewUri(vscode.Uri.file(scriptPath))
      .toString();

    const cspSource = webview.cspSource;
    return htmlTemplate
      .replace("style.css", styleUri)
      .replace("js/main.js", scriptUri)
      .replace(
        /default-src 'none'; style-src https:\/\/cdn\.jsdelivr\.net 'unsafe-inline'; script-src 'nonce-\{\{nonce\}\}'; img-src \{\{cspSource\}\} data:;/g,
        `default-src 'none'; style-src ${cspSource} https://cdn.jsdelivr.net 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${cspSource} data:;`,
      )
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{cspSource\}\}/g, cspSource);
  }

  /**
   * Dispose the webview panel and release resources.
   */
  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}
