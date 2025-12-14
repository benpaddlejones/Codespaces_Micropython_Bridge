import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

interface FileTreeItem extends vscode.TreeItem {
  uri: vscode.Uri;
  resourceUri: vscode.Uri;
  isDirectory: boolean;
}

/**
 * Tree data provider for displaying MicroPython project files.
 *
 * This provider:
 * - Detects MicroPython projects by looking for `.micropico` marker files
 * - Displays Python files and directories in a tree view
 * - Watches for file system changes and auto-refreshes
 * - Filters out non-Python files and common ignored directories
 *
 * Projects are identified by the presence of a `.micropico` file,
 * which can be created using the project setup commands.
 */
export class WorkspaceFilesProvider
  implements vscode.TreeDataProvider<FileTreeItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    FileTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private projectPath: string | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.detectProject();

    // Watch for Python file changes
    const pyWatcher = vscode.workspace.createFileSystemWatcher("**/*.py");
    this.disposables.push(pyWatcher);
    this.disposables.push(pyWatcher.onDidCreate(() => this.refresh()));
    this.disposables.push(pyWatcher.onDidDelete(() => this.refresh()));
    this.disposables.push(pyWatcher.onDidChange(() => this.refresh()));

    // Watch for .micropico marker changes (project detection)
    const markerWatcher =
      vscode.workspace.createFileSystemWatcher("**/.micropico");
    this.disposables.push(markerWatcher);
    this.disposables.push(markerWatcher.onDidCreate(() => this.refresh()));
    this.disposables.push(markerWatcher.onDidDelete(() => this.refresh()));

    // Watch for any folder changes (project creation/deletion)
    const folderWatcher = vscode.workspace.createFileSystemWatcher(
      "**/*",
      false,
      true,
      false
    );
    this.disposables.push(folderWatcher);
    this.disposables.push(folderWatcher.onDidCreate(() => this.refresh()));
    this.disposables.push(folderWatcher.onDidDelete(() => this.refresh()));
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

        if (name.startsWith(".") || name === "__pycache__") {
          continue;
        }

        if (!isDirectory && !name.endsWith(".py")) {
          continue;
        }

        const item: FileTreeItem = {
          label: name,
          uri: fileUri,
          resourceUri: fileUri,
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

        if (!isDirectory) {
          item.command = {
            command: "vscode.open",
            title: "Open File",
            arguments: [fileUri],
          };
        }

        items.push(item);
      }

      items.sort((a, b) => {
        const aPriority = this.getSortPriority(a);
        const bPriority = this.getSortPriority(b);

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        return (a.label as string).localeCompare(b.label as string);
      });

      return items;
    } catch {
      // Error reading directory - return empty list
      return [];
    }
  }

  private detectProject(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.projectPath = undefined;
      this.updateContext(false);
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    const markerFolder = this.findMarkerFolder(workspaceRoot, 4);
    if (markerFolder) {
      this.projectPath = markerFolder;
      this.updateContext(true);
      return;
    }

    this.projectPath = undefined;
    this.updateContext(false);
  }

  private updateContext(detected: boolean): void {
    vscode.commands.executeCommand(
      "setContext",
      "picoBridge.projectDetected",
      detected
    );
  }

  private folderHasMarker(folder: string): boolean {
    const marker = path.join(folder, ".micropico");
    return fs.existsSync(marker);
  }

  private findMarkerFolder(
    start: string,
    maxDepth: number
  ): string | undefined {
    const queue: Array<{ dir: string; depth: number }> = [
      { dir: start, depth: 0 },
    ];
    const visited = new Set<string>();
    const exclude = new Set([
      "node_modules",
      "bower_components",
      ".git",
      ".hg",
      ".svn",
      ".vscode",
      "__pycache__",
      ".venv",
      ".mypy_cache",
    ]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      const { dir, depth } = current;

      if (!dir || visited.has(dir)) {
        continue;
      }
      visited.add(dir);

      if (this.folderHasMarker(dir)) {
        return dir;
      }

      if (depth >= maxDepth) {
        continue;
      }

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (_error) {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        if (entry.name.startsWith(".")) {
          continue;
        }

        if (exclude.has(entry.name)) {
          continue;
        }

        queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
      }
    }

    return undefined;
  }

  private getSortPriority(item: FileTreeItem): number {
    if (item.isDirectory) {
      const label = (item.label as string).toLowerCase();
      if (label === "project") {
        return 0;
      }
      return 1;
    }
    return 2;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
