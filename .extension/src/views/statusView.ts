/**
 * Status View Provider
 *
 * Displays the current status of the Pico Bridge server in the sidebar.
 */

import * as vscode from "vscode";
import { BridgeServer } from "../server";

interface StatusItem extends vscode.TreeItem {
  children?: StatusItem[];
}

export class StatusViewProvider
  implements vscode.TreeDataProvider<StatusItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    StatusItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private server: BridgeServer) {
    // Listen for server status changes
    this.disposables.push(
      server.onStatusChange(() => {
        this.refresh();
      })
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StatusItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: StatusItem): Thenable<StatusItem[]> {
    if (element) {
      return Promise.resolve(element.children || []);
    }

    const status = this.server.status;
    const items: StatusItem[] = [];

    // Server status
    const serverStatus = new vscode.TreeItem(
      status.running ? "Server: Running" : "Server: Stopped",
      vscode.TreeItemCollapsibleState.None
    ) as StatusItem;
    serverStatus.iconPath = new vscode.ThemeIcon(
      status.running ? "pass-filled" : "circle-outline",
      status.running
        ? new vscode.ThemeColor("testing.iconPassed")
        : new vscode.ThemeColor("testing.iconSkipped")
    );
    serverStatus.tooltip = status.running
      ? `Running on port ${status.port}`
      : "Click to start server";
    serverStatus.command = status.running
      ? { command: "picoBridge.stopServer", title: "Stop Server" }
      : { command: "picoBridge.startServer", title: "Start Server" };
    items.push(serverStatus);

    // Port info (when running)
    if (status.running) {
      const portItem = new vscode.TreeItem(
        `Port: ${status.port}`,
        vscode.TreeItemCollapsibleState.None
      ) as StatusItem;
      portItem.iconPath = new vscode.ThemeIcon("broadcast");
      portItem.tooltip = "Server listening port";
      items.push(portItem);

      // URL
      if (status.url) {
        const urlItem = new vscode.TreeItem(
          status.url,
          vscode.TreeItemCollapsibleState.None
        ) as StatusItem;
        urlItem.iconPath = new vscode.ThemeIcon("link-external");
        urlItem.tooltip = "Click to open in browser";
        urlItem.command = {
          command: "picoBridge.openBrowser",
          title: "Open Browser",
        };
        items.push(urlItem);
      }

      // Uptime
      if (status.startTime) {
        const uptime = this.formatUptime(status.startTime);
        const uptimeItem = new vscode.TreeItem(
          `Uptime: ${uptime}`,
          vscode.TreeItemCollapsibleState.None
        ) as StatusItem;
        uptimeItem.iconPath = new vscode.ThemeIcon("clock");
        items.push(uptimeItem);
      }
    }

    return Promise.resolve(items);
  }

  private formatUptime(startTime: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) {
      return `${diffSecs}s`;
    }

    const diffMins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;

    if (diffMins < 60) {
      return `${diffMins}m ${secs}s`;
    }

    const diffHours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    return `${diffHours}h ${mins}m`;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
