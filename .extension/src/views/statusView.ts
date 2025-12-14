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

    // === STATUS SECTION ===
    const serverStatus = new vscode.TreeItem(
      status.running ? "Server: Running ✓" : "Server: Stopped",
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
      : "Server is not running";
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
    }

    // Separator before buttons
    const sep2 = new vscode.TreeItem(
      "───────────────",
      vscode.TreeItemCollapsibleState.None
    ) as StatusItem;
    items.push(sep2);

    // === BUTTONS AT BOTTOM ===
    if (status.running) {
      // Open Browser button
      const openBrowserBtn = new vscode.TreeItem(
        "Open in Browser",
        vscode.TreeItemCollapsibleState.None
      ) as StatusItem;
      openBrowserBtn.iconPath = new vscode.ThemeIcon("globe");
      openBrowserBtn.tooltip = "Open bridge interface in browser";
      openBrowserBtn.command = {
        command: "picoBridge.openBrowser",
        title: "Open Browser",
      };
      items.push(openBrowserBtn);

      // Stop Server button
      const stopServerBtn = new vscode.TreeItem(
        "Stop Server",
        vscode.TreeItemCollapsibleState.None
      ) as StatusItem;
      stopServerBtn.iconPath = new vscode.ThemeIcon("debug-stop");
      stopServerBtn.tooltip = "Stop the bridge server";
      stopServerBtn.command = {
        command: "picoBridge.stopServer",
        title: "Stop Server",
      };
      items.push(stopServerBtn);
    } else {
      // Start Server button
      const startServerBtn = new vscode.TreeItem(
        "Start Server",
        vscode.TreeItemCollapsibleState.None
      ) as StatusItem;
      startServerBtn.iconPath = new vscode.ThemeIcon("play");
      startServerBtn.tooltip = "Start the bridge server";
      startServerBtn.command = {
        command: "picoBridge.startServer",
        title: "Start Server",
      };
      items.push(startServerBtn);
    }

    return Promise.resolve(items);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
