import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { Logger } from "../utils";

type PanelMessageHandler = (message: unknown) => void;

export class EmulatorWebview {
  private panel: vscode.WebviewPanel | undefined;
  private currentBoard: string = "pico";

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger,
    private readonly onMessage: PanelMessageHandler
  ) {}

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
      }
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

  private getBoardSvgPath(board: string): string {
    const webviewRoot = path.join(
      this.context.extensionPath,
      "emulator",
      "webview"
    );
    const boardFile = `board-${board}.svg`;
    return path.join(webviewRoot, boardFile);
  }

  private getPinoutSvgPath(board: string): string {
    const pinoutsRoot = path.join(
      this.context.extensionPath,
      "media",
      "pinouts"
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

  public postMessage(message: unknown): void {
    if (!this.panel) {
      return;
    }
    this.panel.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const webviewRoot = path.join(
      this.context.extensionPath,
      "emulator",
      "webview"
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
      .replace(/{{nonce}}/g, nonce)
      .replace(/{{cspSource}}/g, cspSource)
      .replace(
        /default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-{{nonce}}'; img-src {{cspSource}} data:;/g,
        `default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${cspSource} data:;`
      );
  }
}
