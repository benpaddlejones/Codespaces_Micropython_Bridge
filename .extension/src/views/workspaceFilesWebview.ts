import * as crypto from "crypto";
import * as path from "path";
import * as vscode from "vscode";
import type { BridgeServer } from "../server";

/**
 * A serialisable node in the project file tree sent to the webview.
 */
interface FileNode {
  /** Display name of the file or directory */
  name: string;
  /** Absolute filesystem path */
  path: string;
  /** `true` if this node is a directory */
  isDirectory: boolean;
  /** Child nodes (directories only) */
  children?: FileNode[];
}

/**
 * Webview-based provider for the PROJECT FILES panel.
 *
 * Unlike a native {@link vscode.TreeView}, whose inline action buttons are
 * hidden by VS Code's own CSS until a row is hovered or focused, this webview
 * renders the file list as HTML that we fully control. Per-file action buttons
 * (Run in Emulator, Debug, Run on Device, Upload) are therefore always visible.
 *
 * Projects are identified by the presence of a `.micropico` marker file.
 */
export class WorkspaceFilesWebviewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  /** Identifier matching the `views` contribution in package.json. */
  public static readonly viewId = "picoBridge.workspaceFiles";

  /**
   * Paths matching this pattern are ignored by the filesystem watchers to
   * avoid render storms from VCS, virtualenv, cache, and dependency churn.
   */
  private static readonly IGNORED_PATH =
    /[/\\](?:\.git|\.venv|venv|node_modules|__pycache__|\.mypy_cache|\.pytest_cache)[/\\]/;

  private view: vscode.WebviewView | undefined;
  private projectPath: string | undefined;
  private serverRunning = false;

  private readonly disposables: vscode.Disposable[] = [];
  private treeRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  private projectRefreshTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Create a new WorkspaceFilesWebviewProvider.
   *
   * @param context - Extension context, used to resolve resource roots
   * @param server - Bridge server, used to reflect device-action availability
   */
  constructor(
    private readonly context: vscode.ExtensionContext,
    server: BridgeServer,
  ) {
    this.serverRunning = server.isRunning;

    // Reflect server start/stop so the device-only buttons appear/disappear.
    this.disposables.push(
      server.onStatusChange((status) => {
        this.serverRunning = status.running;
        void this.render();
      }),
    );

    // Kick off async project detection — does not block activation.
    void this.detectProject();

    // Watch Python file changes — redraw only, no project re-scan.
    const pyWatcher = vscode.workspace.createFileSystemWatcher("**/*.py");
    this.disposables.push(pyWatcher);
    this.disposables.push(
      pyWatcher.onDidCreate((uri) => this.onWatchedChange(uri)),
    );
    this.disposables.push(
      pyWatcher.onDidDelete((uri) => this.onWatchedChange(uri)),
    );

    // Watch .micropico marker changes — must re-detect the active project.
    const markerWatcher =
      vscode.workspace.createFileSystemWatcher("**/.micropico");
    this.disposables.push(markerWatcher);
    this.disposables.push(
      markerWatcher.onDidCreate(() => this.scheduleProjectRefresh()),
    );
    this.disposables.push(
      markerWatcher.onDidDelete(() => this.scheduleProjectRefresh()),
    );

    // Watch folder structure changes — redraw only, no project re-scan.
    const folderWatcher = vscode.workspace.createFileSystemWatcher(
      "**/*",
      false,
      true,
      false,
    );
    this.disposables.push(folderWatcher);
    this.disposables.push(
      folderWatcher.onDidCreate((uri) => this.onWatchedChange(uri)),
    );
    this.disposables.push(
      folderWatcher.onDidDelete((uri) => this.onWatchedChange(uri)),
    );
  }

  /**
   * Handle a filesystem watcher event, ignoring churn from directories that
   * are irrelevant to the project tree (VCS, virtualenvs, caches, deps).
   *
   * Without this filter the broad recursive watcher fires continuously — e.g.
   * when the bridge server starts, or during background Git/venv activity —
   * causing a render storm that makes the panel flicker and the extension
   * host sluggish.
   *
   * @param uri - The URI of the changed resource
   */
  private onWatchedChange(uri: vscode.Uri): void {
    if (WorkspaceFilesWebviewProvider.IGNORED_PATH.test(uri.fsPath)) {
      return;
    }
    this.scheduleTreeRefresh();
  }

  /**
   * Resolve the webview view: configure options, set HTML, and wire messaging.
   */
  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(this.context.extensionPath)],
    };

    // Register the message listener BEFORE setting the HTML. The webview's
    // script posts a `ready` message as soon as it runs; if the listener were
    // wired up after assigning `.html`, that message could fire in the gap and
    // be lost — leaving `#root` empty and the panel apparently unstyled.
    this.disposables.push(
      webviewView.webview.onDidReceiveMessage((message) =>
        this.handleMessage(message),
      ),
    );

    webviewView.webview.html = this.getHtml(webviewView.webview);

    // Push an initial render immediately rather than waiting solely on the
    // `ready` round-trip, so content appears as soon as the view resolves.
    void this.render();

    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
  }

  /** Re-detect the active project and redraw the panel. */
  refresh(): void {
    void this.detectProject();
  }

  /**
   * Handle a message posted from the webview.
   *
   * @param message - The raw message object from the webview
   */
  private handleMessage(message: unknown): void {
    if (!message || typeof message !== "object") {
      return;
    }

    const msg = message as { type?: string; path?: string };

    switch (msg.type) {
      case "ready":
        void this.render();
        break;
      case "open":
        if (msg.path) {
          void vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(msg.path),
          );
        }
        break;
      case "runEmulator":
        if (msg.path) {
          void vscode.commands.executeCommand(
            "picoBridge.runActiveFileInEmulator",
            vscode.Uri.file(msg.path),
          );
        }
        break;
      case "debug":
        if (msg.path) {
          void vscode.commands.executeCommand(
            "picoBridge.debugPythonFile",
            vscode.Uri.file(msg.path),
          );
        }
        break;
      case "runDevice":
        if (msg.path) {
          void vscode.commands.executeCommand(
            "picoBridge.runFile",
            vscode.Uri.file(msg.path),
          );
        }
        break;
      case "upload":
        if (msg.path) {
          void vscode.commands.executeCommand(
            "picoBridge.uploadFile",
            vscode.Uri.file(msg.path),
          );
        }
        break;
      case "createBasicProject":
        void vscode.commands.executeCommand("picoBridge.createBasicProject");
        break;
      case "createProject":
        void vscode.commands.executeCommand("picoBridge.createProject");
        break;
      case "setupExistingProject":
        void vscode.commands.executeCommand("picoBridge.setupExistingProject");
        break;
    }
  }

  /**
   * Debounced tree redraw — does NOT re-scan for the project root.
   */
  private scheduleTreeRefresh(): void {
    clearTimeout(this.treeRefreshTimer);
    this.treeRefreshTimer = setTimeout(() => {
      void this.render();
    }, 150);
  }

  /**
   * Debounced full refresh — re-detects the active project then redraws.
   */
  private scheduleProjectRefresh(): void {
    clearTimeout(this.projectRefreshTimer);
    this.projectRefreshTimer = setTimeout(() => {
      void this.detectProject();
    }, 300);
  }

  /**
   * Detect the active MicroPython project folder via the `.micropico` marker.
   */
  private async detectProject(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.projectPath = undefined;
      this.updateContext(false);
      await this.render();
      return;
    }

    const markers = await vscode.workspace.findFiles(
      "**/.micropico",
      "{**/node_modules/**,**/.git/**,**/.venv/**,**/__pycache__/**}",
      1,
    );

    if (markers.length > 0) {
      this.projectPath = path.dirname(markers[0].fsPath);
      this.updateContext(true);
    } else {
      this.projectPath = undefined;
      this.updateContext(false);
    }

    await this.render();
  }

  /**
   * Update the `picoBridge.projectDetected` context key.
   */
  private updateContext(detected: boolean): void {
    void vscode.commands.executeCommand(
      "setContext",
      "picoBridge.projectDetected",
      detected,
    );
  }

  /**
   * Build the file tree and post a state update to the webview.
   */
  private async render(): Promise<void> {
    if (!this.view) {
      return;
    }

    const tree = this.projectPath
      ? await this.buildTree(this.projectPath, 0)
      : [];

    void this.view.webview.postMessage({
      type: "update",
      projectDetected: !!this.projectPath,
      serverRunning: this.serverRunning,
      tree,
    });
  }

  /**
   * Recursively build the file tree starting at a directory.
   *
   * Only `.py` files and directories are included; dotfiles and
   * `__pycache__` are skipped. Recursion is bounded to avoid runaway scans.
   *
   * @param dirPath - Absolute directory path to scan
   * @param depth - Current recursion depth
   * @returns Sorted array of file nodes
   */
  private async buildTree(dirPath: string, depth: number): Promise<FileNode[]> {
    if (depth > 8) {
      return [];
    }

    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(
        vscode.Uri.file(dirPath),
      );
    } catch {
      return [];
    }

    const nodes: FileNode[] = [];

    for (const [name, type] of entries) {
      const isDirectory = type === vscode.FileType.Directory;

      if (name.startsWith(".") || name === "__pycache__") {
        continue;
      }
      if (name === "node_modules") {
        continue;
      }
      if (!isDirectory && !name.endsWith(".py")) {
        continue;
      }

      const fullPath = path.join(dirPath, name);
      const node: FileNode = { name, path: fullPath, isDirectory };

      if (isDirectory) {
        node.children = await this.buildTree(fullPath, depth + 1);
      }

      nodes.push(node);
    }

    nodes.sort((a, b) => {
      const aPriority = this.getSortPriority(a);
      const bPriority = this.getSortPriority(b);
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return a.name.localeCompare(b.name);
    });

    return nodes;
  }

  /**
   * Return a numeric sort priority: `project` dir first, other dirs, then files.
   */
  private getSortPriority(node: FileNode): number {
    if (node.isDirectory) {
      if (node.name.toLowerCase() === "project") {
        return 0;
      }
      return 1;
    }
    return 2;
  }

  /**
   * Build the static HTML shell for the webview, including CSS, the rendering
   * script, and a CSP with a per-load nonce.
   */
  private getHtml(webview: vscode.Webview): string {
    const nonce = crypto.randomBytes(16).toString("hex");
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      --row-pad: 4px;
    }
    body {
      padding: 4px 0;
      margin: 0;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .empty {
      padding: 12px 16px;
      line-height: 1.5;
    }
    .empty p { margin: 0 0 12px 0; }
    .welcome-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      box-sizing: border-box;
      padding: 6px 10px;
      margin-bottom: 8px;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      text-align: left;
    }
    .welcome-btn:hover { background: var(--vscode-button-hoverBackground); }
    ul.tree { list-style: none; margin: 0; padding: 0; }
    ul.tree ul { list-style: none; margin: 0; padding: 0; }
    .row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: var(--row-pad) 6px var(--row-pad) 6px;
      border-radius: 2px;
      cursor: pointer;
      user-select: none;
    }
    .row:hover { background: var(--vscode-list-hoverBackground); }
    .row .label {
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .twisty {
      flex: 0 0 auto;
      width: 12px;
      text-align: center;
      opacity: 0.8;
    }
    .nicon { flex: 0 0 auto; display: inline-flex; }
    .nicon svg { width: 16px; height: 16px; fill: currentColor; }
    .actions {
      flex: 0 0 auto;
      display: inline-flex;
      gap: 2px;
      /* Always visible — this is the whole point of the webview. */
      opacity: 1;
    }
    .act-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      border-radius: 3px;
      background: transparent;
      color: var(--vscode-icon-foreground);
      cursor: pointer;
    }
    .act-btn svg { width: 16px; height: 16px; fill: currentColor; }
    .act-btn:hover {
      background: var(--vscode-toolbar-hoverBackground,
        var(--vscode-list-hoverBackground));
    }
    .children { padding-left: 12px; }
  </style>
</head>
<body>
  <div id="root"><div class="empty"><p>Loading project…</p></div></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const ICONS = {
      folder: '<svg viewBox="0 0 16 16"><path d="M14.5 3H7.7L6.9 2H1.5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zM14 13H2V4h12v9z"/></svg>',
      file: '<svg viewBox="0 0 16 16"><path d="M10 1H3.5L3 1.5v13l.5.5h10l.5-.5V5l-4-4zM10 2.5L12.5 5H10V2.5zM4 14V2h5v4h4v8H4z"/></svg>',
      play: '<svg viewBox="0 0 16 16"><path d="M4.74514 3.06414C4.41183 2.87665 4 3.11751 4 3.49993V12.5002C4 12.8826 4.41182 13.1235 4.74512 12.936L12.7454 8.43601C13.0852 8.24486 13.0852 7.75559 12.7454 7.56443L4.74514 3.06414ZM3 3.49993C3 2.35268 4.2355 1.63011 5.23541 2.19257L13.2357 6.69286C14.2551 7.26633 14.2551 8.73415 13.2356 9.30759L5.23537 13.8076C4.23546 14.37 3 13.6474 3 12.5002V3.49993Z"/></svg>',
      bug: '<svg viewBox="0 0 16 16"><path d="M14.5 8H13V6C13 5.63 12.898 5.283 12.722 4.985L13.853 3.854C14.048 3.659 14.048 3.342 13.853 3.147C13.658 2.952 13.341 2.952 13.146 3.147L12.015 4.278C11.717 4.102 11.37 4 11 4C11 2.346 9.654 1 8 1C6.346 1 5 2.346 5 4C4.63 4 4.283 4.102 3.985 4.278L2.854 3.147C2.659 2.952 2.342 2.952 2.147 3.147C1.952 3.342 1.952 3.659 2.147 3.854L3.278 4.985C3.102 5.283 3 5.63 3 6V8H1.5C1.224 8 1 8.224 1 8.5C1 8.776 1.224 9 1.5 9H3C3 10.199 3.424 11.3 4.13 12.163L2.396 13.897C2.201 14.092 2.201 14.409 2.396 14.604C2.494 14.702 2.622 14.75 2.75 14.75C2.878 14.75 3.006 14.701 3.104 14.604L4.838 12.87C5.7 13.576 6.802 14 8.001 14C9.2 14 10.301 13.576 11.164 12.87L12.898 14.604C12.996 14.702 13.124 14.75 13.252 14.75C13.38 14.75 13.508 14.701 13.606 14.604C13.801 14.409 13.801 14.092 13.606 13.897L11.872 12.163C12.578 11.301 13.002 10.199 13.002 9H14.502C14.778 9 15.002 8.776 15.002 8.5C15.002 8.224 14.778 8 14.502 8H14.5ZM8 2C9.103 2 10 2.897 10 4H6C6 2.897 6.897 2 8 2ZM12 9C12 11.206 10.206 13 8 13C5.794 13 4 11.206 4 9V6C4 5.449 4.448 5 5 5H11C11.552 5 12 5.449 12 6V9Z"/></svg>',
      device: '<svg viewBox="0 0 16 16"><path d="M3 1C1.895 1 1 1.895 1 3V10C1 11.105 1.895 12 3 12H5V14H3.5C3.224 14 3 14.224 3 14.5C3 14.776 3.224 15 3.5 15H12.5C12.776 15 13 14.776 13 14.5C13 14.224 12.776 14 12.5 14H11V12H13C14.105 12 15 11.105 15 10V3C15 1.895 14.105 1 13 1H3ZM10 12V14H6V12H10ZM2 3C2 2.448 2.448 2 3 2H13C13.552 2 14 2.448 14 3V10C14 10.552 13.552 11 13 11H3C2.448 11 2 10.552 2 10V3Z"/></svg>',
      upload: '<svg viewBox="0 0 16 16"><path d="M11.5 7C9.015 7 7 9.015 7 11.5C7 13.985 9.015 16 11.5 16C13.985 16 16 13.985 16 11.5C16 9.015 13.985 7 11.5 7ZM13.854 11.854C13.659 12.049 13.342 12.049 13.147 11.854L12.001 10.708V14.001C12.001 14.277 11.777 14.501 11.501 14.501C11.225 14.501 11.001 14.277 11.001 14.001V10.708L9.855 11.854C9.66 12.049 9.343 12.049 9.148 11.854C8.953 11.659 8.953 11.342 9.148 11.147L11.148 9.147C11.196 9.099 11.251 9.063 11.31 9.039C11.368 9.015 11.432 9.001 11.498 9.001H11.504C11.571 9.001 11.634 9.015 11.692 9.039C11.75 9.063 11.805 9.099 11.852 9.145L11.855 9.148L13.855 11.148C14.05 11.343 14.05 11.66 13.855 11.855L13.854 11.854ZM4.25 12H6V13H4.25C2.455 13 1 11.545 1 9.75C1 8.029 2.338 6.62 4.03 6.507C4.273 4.53 5.958 3 8 3C9.862 3 11.411 4.278 11.857 6H10.811C10.397 4.838 9.303 4 8 4C6.343 4 5 5.343 5 7C5 7.276 4.776 7.5 4.5 7.5H4.25C3.007 7.5 2 8.507 2 9.75C2 10.993 3.007 12 4.25 12Z"/></svg>',
    };

    function makeBtn(icon, title, type, path) {
      const b = document.createElement('button');
      b.className = 'act-btn';
      b.title = title;
      b.setAttribute('aria-label', title);
      b.innerHTML = ICONS[icon];
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ type, path });
      });
      return b;
    }

    function renderNodes(nodes, serverRunning) {
      const ul = document.createElement('ul');
      ul.className = 'tree';
      for (const node of nodes) {
        ul.appendChild(renderNode(node, serverRunning));
      }
      return ul;
    }

    function renderNode(node, serverRunning) {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'row';

      const icon = document.createElement('span');
      icon.className = 'nicon';
      icon.innerHTML = node.isDirectory ? ICONS.folder : ICONS.file;

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = node.name;

      if (node.isDirectory) {
        const twisty = document.createElement('span');
        twisty.className = 'twisty';
        twisty.textContent = '▸';
        row.appendChild(twisty);
        row.appendChild(icon);
        row.appendChild(label);

        const childWrap = document.createElement('div');
        childWrap.className = 'children';
        childWrap.style.display = 'none';
        if (node.children && node.children.length) {
          childWrap.appendChild(renderNodes(node.children, serverRunning));
        }

        row.addEventListener('click', () => {
          const open = childWrap.style.display !== 'none';
          childWrap.style.display = open ? 'none' : 'block';
          twisty.textContent = open ? '▸' : '▾';
        });

        li.appendChild(row);
        li.appendChild(childWrap);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'twisty';
        row.appendChild(spacer);
        row.appendChild(icon);
        row.appendChild(label);

        const actions = document.createElement('span');
        actions.className = 'actions';
        actions.appendChild(
          makeBtn('play', 'Run in Emulator', 'runEmulator', node.path));
        actions.appendChild(
          makeBtn('bug', 'Debug in Emulator', 'debug', node.path));
        if (serverRunning) {
          actions.appendChild(
            makeBtn('device', 'Open in Browser (Run / Upload to Device)',
              'runDevice', node.path));
        }
        row.appendChild(actions);

        row.addEventListener('click', () => {
          vscode.postMessage({ type: 'open', path: node.path });
        });

        li.appendChild(row);
      }

      return li;
    }

    function renderWelcome() {
      const wrap = document.createElement('div');
      wrap.className = 'empty';
      const p = document.createElement('p');
      p.textContent = 'No MicroPython project detected.';
      wrap.appendChild(p);

      const buttons = [
        ['Create Basic Project', 'createBasicProject'],
        ['Create Project with Adv Debugging', 'createProject'],
        ['Setup Existing Project', 'setupExistingProject'],
      ];
      for (const [text, type] of buttons) {
        const b = document.createElement('button');
        b.className = 'welcome-btn';
        b.textContent = text;
        b.addEventListener('click', () =>
          vscode.postMessage({ type }));
        wrap.appendChild(b);
      }
      return wrap;
    }

    function renderEmptyProject() {
      const wrap = document.createElement('div');
      wrap.className = 'empty';
      const p = document.createElement('p');
      p.textContent =
        'No Python files found. Create a main.py to get started.';
      wrap.appendChild(p);
      return wrap;
    }

    function update(state) {
      const root = document.getElementById('root');
      root.textContent = '';
      if (!state.projectDetected) {
        root.appendChild(renderWelcome());
        return;
      }
      if (!state.tree || state.tree.length === 0) {
        root.appendChild(renderEmptyProject());
        return;
      }
      root.appendChild(renderNodes(state.tree, state.serverRunning));
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg && msg.type === 'update') {
        update(msg);
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }

  /**
   * Dispose watchers, timers, and event subscriptions.
   */
  dispose(): void {
    clearTimeout(this.treeRefreshTimer);
    clearTimeout(this.projectRefreshTimer);
    this.disposables.forEach((d) => d.dispose());
  }
}
