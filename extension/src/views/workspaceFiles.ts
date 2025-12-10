/**
 * Workspace Files View Provider
 *
 * Displays Python/MicroPython files in the project folder.
 * Detects MicroPython projects by looking for .micropython marker file.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

interface FileTreeItem extends vscode.TreeItem {
  uri: vscode.Uri;
  isDirectory: boolean;
}

export class WorkspaceFilesProvider
  implements vscode.TreeDataProvider<FileTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    FileTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private projectPath: string | undefined;

  constructor() {
    // Find the project folder or detect .micropython marker
    this.detectProject();

    // Watch for file changes
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.py");
    watcher.onDidCreate(() => this.refresh());
    watcher.onDidDelete(() => this.refresh());
    watcher.onDidChange(() => this.refresh());

    // Watch for .micropython marker
    const markerWatcher =
      vscode.workspace.createFileSystemWatcher("**/.micropython");
    markerWatcher.onDidCreate(() => {
      this.detectProject();
      this.refresh();
    });
    markerWatcher.onDidDelete(() => {
      this.detectProject();
      this.refresh();
    });
  }

  /**
   * Detect MicroPython project by looking for .micropython marker
   */
  private detectProject(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.projectPath = undefined;
      this.updateContext(false);
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Check for .micropython marker in root
    const rootMarker = path.join(workspaceRoot, ".micropython");
    if (fs.existsSync(rootMarker)) {
      this.projectPath = workspaceRoot;
      this.updateContext(true);
      return;
    }

    // Check for project/ folder with .micropython marker
    const projectFolder = path.join(workspaceRoot, "project");
    const projectMarker = path.join(projectFolder, ".micropython");
    if (fs.existsSync(projectMarker)) {
      this.projectPath = projectFolder;
      this.updateContext(true);
      return;
    }

    // Fallback: check if project/ folder exists (backwards compatibility)
    if (fs.existsSync(projectFolder)) {
      this.projectPath = projectFolder;
      this.updateContext(true);
      return;
    }

    this.projectPath = undefined;
    this.updateContext(false);
  }

  /**
   * Update VS Code context for when clauses
   */
  private updateContext(detected: boolean): void {
    vscode.commands.executeCommand(
      "setContext",
      "picoBridge.projectDetected",
      detected
    );
  }

  refresh(): void {
    this.detectProject();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FileTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: FileTreeItem): Promise<FileTreeItem[]> {
    if (!this.projectPath) {
      return [];
    }

    const dirPath = element ? element.uri.fsPath : this.projectPath;

    try {
      const dirUri = vscode.Uri.file(dirPath);
      const entries = await vscode.workspace.fs.readDirectory(dirUri);

      const items: FileTreeItem[] = [];

      for (const [name, type] of entries) {
        const fileUri = vscode.Uri.file(path.join(dirPath, name));
        const isDirectory = type === vscode.FileType.Directory;

        // Skip hidden files and __pycache__
        if (name.startsWith(".") || name === "__pycache__") {
          continue;
        }

        // For files, only show Python files
        if (!isDirectory && !name.endsWith(".py")) {
          continue;
        }

        const item: FileTreeItem = {
          label: name,
          uri: fileUri,
          isDirectory,
          collapsibleState: isDirectory
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
          iconPath: isDirectory
            ? new vscode.ThemeIcon("folder")
            : new vscode.ThemeIcon("file-code"),
          tooltip: fileUri.fsPath,
          contextValue: isDirectory ? "folder" : "pythonFile",
        };

        // Add command to open file
        if (!isDirectory) {
          item.command = {
            command: "vscode.open",
            title: "Open File",
            arguments: [fileUri],
          };
        }

        items.push(item);
      }

      // Sort: directories first, then alphabetically
      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return (a.label as string).localeCompare(b.label as string);
      });

      return items;
    } catch (error) {
      console.error("Error reading directory:", error);
      return [];
    }
  }
}
