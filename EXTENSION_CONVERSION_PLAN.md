# Pico Bridge VS Code Extension Conversion Plan

## Executive Summary

This document provides a comprehensive plan for converting the Pico Codespaces Bridge from a standalone web application into a fully functioning, documented VS Code extension. The extension will enable seamless MicroPython development for Raspberry Pi Pico and ESP32 devices directly from GitHub Codespaces.

**Critical Requirement**: The bridge UI **MUST** run in an external browser (not a VS Code webview) because the Web Serial API is not available in webviews.

---

## Table of Contents

1. [Phase 1: Project Structure & Scaffolding](#phase-1-project-structure--scaffolding)
2. [Phase 2: Extension Manifest & Configuration](#phase-2-extension-manifest--configuration)
3. [Phase 3: Core Extension Implementation](#phase-3-core-extension-implementation)
4. [Phase 4: UI/UX Integration](#phase-4-uiux-integration)
5. [Phase 5: Commands & Keybindings](#phase-5-commands--keybindings)
6. [Phase 6: Settings & Configuration](#phase-6-settings--configuration)
7. [Phase 7: Views & Activity Bar](#phase-7-views--activity-bar)
8. [Phase 8: Icons & Branding](#phase-8-icons--branding)
9. [Phase 9: Documentation](#phase-9-documentation)
10. [Phase 10: Testing](#phase-10-testing)
11. [Phase 11: Packaging & Publishing](#phase-11-packaging--publishing)
12. [Verification Checklist](#verification-checklist)

---

## Phase 1: Project Structure & Scaffolding

### 1.1 New Directory Structure

```
extension/
├── .vscode/
│   ├── launch.json              # Debug configurations
│   ├── tasks.json               # Build tasks
│   └── settings.json            # Extension dev settings
├── src/
│   ├── extension.ts             # Extension entry point
│   ├── server/
│   │   ├── bridgeServer.ts      # Server lifecycle management
│   │   ├── serverStatus.ts      # Server health monitoring
│   │   └── portManager.ts       # Port allocation/forwarding
│   ├── commands/
│   │   ├── index.ts             # Command registration
│   │   ├── bridgeCommands.ts    # Start/stop bridge commands
│   │   ├── picoCommands.ts      # Pico-specific commands
│   │   └── fileCommands.ts      # File upload/run commands
│   ├── views/
│   │   ├── picoExplorer.ts      # Tree view for Pico files
│   │   ├── deviceStatus.ts      # Device status view
│   │   └── welcomeView.ts       # Welcome/onboarding view
│   ├── providers/
│   │   ├── taskProvider.ts      # Task provider for Pico tasks
│   │   └── fileDecorator.ts     # File decorations for .py files
│   ├── utils/
│   │   ├── logger.ts            # Output channel logging
│   │   ├── config.ts            # Configuration management
│   │   └── platform.ts          # Platform detection
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── media/
│   ├── icons/
│   │   ├── pico-light.svg       # Light theme icon
│   │   ├── pico-dark.svg        # Dark theme icon
│   │   ├── icon.png             # Marketplace icon (128x128)
│   │   └── logo.png             # Extension logo (256x256)
│   └── walkthrough/
│       ├── connect.png          # Walkthrough images
│       ├── upload.png
│       └── serial.png
├── bridge/                       # Existing bridge code (embedded)
│   └── ... (current bridge files)
├── test/
│   ├── suite/
│   │   ├── extension.test.ts    # Extension tests
│   │   ├── server.test.ts       # Server tests
│   │   └── commands.test.ts     # Command tests
│   └── runTest.ts               # Test runner
├── docs/
│   ├── README.md                # Main documentation
│   ├── CHANGELOG.md             # Version history
│   ├── CONTRIBUTING.md          # Contribution guide
│   └── images/                  # Documentation images
├── package.json                 # Extension manifest
├── tsconfig.json                # TypeScript configuration
├── webpack.config.js            # Bundling configuration
├── .eslintrc.json               # ESLint configuration
├── .vscodeignore                # Files to exclude from VSIX
├── LICENSE                      # License file
└── README.md                    # Marketplace README
```

### 1.2 Dependencies

**VS Code API Documentation Reference**: Extension manifest requires specific fields:
- `name`: Lowercase, no spaces (verified against schema)
- `publisher`: Marketplace publisher ID
- `engines.vscode`: Minimum VS Code version

```json
{
  "devDependencies": {
    "@types/node": "^20.x",
    "@types/vscode": "^1.85.0",
    "@vscode/test-electron": "^2.3.8",
    "@vscode/vsce": "^2.22.0",
    "typescript": "^5.3.0",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "ts-loader": "^9.5.1",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.x",
    "@typescript-eslint/parser": "^6.x"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2"
  }
}
```

### 1.3 TypeScript Configuration

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "out",
    "rootDir": "src",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "bridge"]
}
```

---

## Phase 2: Extension Manifest & Configuration

### 2.1 Complete package.json

**VS Code API Documentation Reference**: The extension manifest must follow the exact schema defined at https://code.visualstudio.com/api/references/extension-manifest

```json
{
  "name": "pico-bridge",
  "displayName": "Pico Codespaces Bridge",
  "description": "Bridge between GitHub Codespaces and Raspberry Pi Pico/ESP32 for MicroPython development",
  "version": "1.0.0",
  "publisher": "benpaddlejones",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/benpaddlejones/Codespaces_Micropython_Bridge"
  },
  "bugs": {
    "url": "https://github.com/benpaddlejones/Codespaces_Micropython_Bridge/issues"
  },
  "homepage": "https://github.com/benpaddlejones/Codespaces_Micropython_Bridge#readme",
  "icon": "media/icons/icon.png",
  "galleryBanner": {
    "color": "#e30b5d",
    "theme": "dark"
  },
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": [
    "Programming Languages",
    "Debuggers",
    "Other"
  ],
  "keywords": [
    "micropython",
    "raspberry pi pico",
    "pico",
    "esp32",
    "codespaces",
    "serial",
    "embedded",
    "microcontroller"
  ],
  "activationEvents": [
    "workspaceContains:**/main.py",
    "onCommand:picoBridge.startServer",
    "onView:picoBridge.deviceExplorer"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [],
    "menus": {},
    "views": {},
    "viewsContainers": {},
    "viewsWelcome": [],
    "configuration": {},
    "keybindings": [],
    "taskDefinitions": [],
    "walkthroughs": []
  },
  "scripts": {
    "vscode:prepublish": "npm run package",
    "compile": "webpack",
    "watch": "webpack --watch",
    "package": "webpack --mode production --devtool hidden-source-map",
    "lint": "eslint src --ext ts",
    "test": "node ./out/test/runTest.js"
  }
}
```

### 2.2 Activation Events

**VS Code API Documentation Reference**: Activation events determine when the extension loads. Use lazy activation for better performance.

| Event | Purpose |
|-------|---------|
| `workspaceContains:**/main.py` | Activate when MicroPython project detected |
| `onCommand:picoBridge.*` | Activate on any bridge command |
| `onView:picoBridge.deviceExplorer` | Activate when device view opened |

---

## Phase 3: Core Extension Implementation

### 3.1 Extension Entry Point (`src/extension.ts`)

**VS Code API Documentation Reference**: 
- `activate()` is called when activation event triggers
- `deactivate()` is called when extension is deactivated
- All disposables must be added to `context.subscriptions`

```typescript
import * as vscode from 'vscode';
import { BridgeServer } from './server/bridgeServer';
import { registerCommands } from './commands';
import { PicoExplorerProvider } from './views/picoExplorer';
import { Logger } from './utils/logger';

let bridgeServer: BridgeServer | undefined;

export async function activate(context: vscode.ExtensionContext) {
    // Initialize logger (Output Channel)
    const logger = new Logger('Pico Bridge');
    context.subscriptions.push(logger);
    
    // Initialize bridge server manager
    bridgeServer = new BridgeServer(context, logger);
    context.subscriptions.push(bridgeServer);
    
    // Register all commands
    registerCommands(context, bridgeServer, logger);
    
    // Register tree view providers
    const picoExplorer = new PicoExplorerProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('picoBridge.deviceExplorer', picoExplorer)
    );
    
    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        'picoBridge.status',
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBarItem.text = '$(plug) Pico Bridge';
    statusBarItem.tooltip = 'Click to start Pico Bridge';
    statusBarItem.command = 'picoBridge.startServer';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    
    // Set context for when clauses
    vscode.commands.executeCommand('setContext', 'picoBridge.serverRunning', false);
    
    logger.info('Pico Bridge extension activated');
}

export function deactivate() {
    if (bridgeServer) {
        bridgeServer.stop();
    }
}
```

### 3.2 Bridge Server Manager (`src/server/bridgeServer.ts`)

**Critical**: Must use `vscode.env.openExternal()` for browser, NOT webviews.

**VS Code API Documentation Reference**:
- `vscode.env.openExternal(uri)` - Opens URL in external browser
- `vscode.env.asExternalUri(uri)` - Resolves port forwarding in Codespaces

```typescript
import * as vscode from 'vscode';
import * as http from 'http';
import * as path from 'path';
import { Logger } from '../utils/logger';

export class BridgeServer implements vscode.Disposable {
    private server: http.Server | undefined;
    private isRunning: boolean = false;
    private port: number = 3000;
    
    constructor(
        private context: vscode.ExtensionContext,
        private logger: Logger
    ) {}
    
    async start(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Server already running');
            return;
        }
        
        try {
            // Import and start the bridge server
            const bridgePath = path.join(this.context.extensionPath, 'bridge');
            
            // Start server (reuse existing bridge/server.js logic)
            await this.startBridgeServer(bridgePath);
            
            this.isRunning = true;
            vscode.commands.executeCommand('setContext', 'picoBridge.serverRunning', true);
            
            // Open in external browser (CRITICAL for Web Serial API)
            await this.openInBrowser();
            
            this.logger.info(`Bridge server started on port ${this.port}`);
            vscode.window.showInformationMessage(
                `Pico Bridge started on port ${this.port}`,
                'Open Browser'
            ).then(selection => {
                if (selection === 'Open Browser') {
                    this.openInBrowser();
                }
            });
            
        } catch (error) {
            this.logger.error(`Failed to start server: ${error}`);
            vscode.window.showErrorMessage(`Failed to start Pico Bridge: ${error}`);
        }
    }
    
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }
        
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
        
        this.isRunning = false;
        vscode.commands.executeCommand('setContext', 'picoBridge.serverRunning', false);
        this.logger.info('Bridge server stopped');
    }
    
    async openInBrowser(): Promise<void> {
        // Use asExternalUri for proper port forwarding in Codespaces
        const localUri = vscode.Uri.parse(`http://localhost:${this.port}`);
        const externalUri = await vscode.env.asExternalUri(localUri);
        
        // Open in external browser (MUST NOT use webview for Web Serial API)
        await vscode.env.openExternal(externalUri);
    }
    
    getStatus(): { running: boolean; port: number } {
        return {
            running: this.isRunning,
            port: this.port
        };
    }
    
    dispose(): void {
        this.stop();
    }
    
    private async startBridgeServer(bridgePath: string): Promise<void> {
        // Implementation will integrate existing bridge/server.js
        // This spawns the Node.js server as a child process
    }
}
```

### 3.3 Logger Implementation (`src/utils/logger.ts`)

**VS Code API Documentation Reference**:
- `window.createOutputChannel()` - Creates output channel
- Output channels provide `append()`, `appendLine()`, `show()`, `clear()`

```typescript
import * as vscode from 'vscode';

export class Logger implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    
    constructor(name: string) {
        this.outputChannel = vscode.window.createOutputChannel(name);
    }
    
    info(message: string): void {
        this.log('INFO', message);
    }
    
    warn(message: string): void {
        this.log('WARN', message);
    }
    
    error(message: string): void {
        this.log('ERROR', message);
    }
    
    private log(level: string, message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`);
    }
    
    show(): void {
        this.outputChannel.show();
    }
    
    dispose(): void {
        this.outputChannel.dispose();
    }
}
```

---

## Phase 4: UI/UX Integration

### 4.1 Status Bar Integration

**VS Code API Documentation Reference**:
- Status bar items have `text`, `tooltip`, `command`, `color`, `backgroundColor`
- Background colors limited to: `statusBarItem.errorBackground`, `statusBarItem.warningBackground`

| State | Icon | Text | Color |
|-------|------|------|-------|
| Stopped | `$(plug)` | "Pico Bridge" | Default |
| Starting | `$(sync~spin)` | "Starting..." | Default |
| Running | `$(broadcast)` | "Pico: Connected" | Green |
| Error | `$(error)` | "Pico: Error" | Error background |

### 4.2 Command Palette Structure

All commands will be prefixed with "Pico Bridge:" in the command palette:

| Command | Title | When |
|---------|-------|------|
| `picoBridge.startServer` | Pico Bridge: Start Server | !serverRunning |
| `picoBridge.stopServer` | Pico Bridge: Stop Server | serverRunning |
| `picoBridge.openBrowser` | Pico Bridge: Open in Browser | serverRunning |
| `picoBridge.runFile` | Pico Bridge: Run Current File | editorLangId == python |
| `picoBridge.uploadFile` | Pico Bridge: Upload File to Pico | editorLangId == python |
| `picoBridge.uploadProject` | Pico Bridge: Upload Entire Project | serverRunning |
| `picoBridge.listFiles` | Pico Bridge: List Files on Pico | serverRunning |
| `picoBridge.openREPL` | Pico Bridge: Open REPL | serverRunning |
| `picoBridge.showLogs` | Pico Bridge: Show Logs | always |

---

## Phase 5: Commands & Keybindings

### 5.1 Commands Contribution

**VS Code API Documentation Reference**: Commands must be registered in `contributes.commands` and implemented via `vscode.commands.registerCommand()`

```json
{
  "contributes": {
    "commands": [
      {
        "command": "picoBridge.startServer",
        "title": "Start Server",
        "category": "Pico Bridge",
        "icon": "$(play)"
      },
      {
        "command": "picoBridge.stopServer",
        "title": "Stop Server",
        "category": "Pico Bridge",
        "icon": "$(debug-stop)"
      },
      {
        "command": "picoBridge.openBrowser",
        "title": "Open in Browser",
        "category": "Pico Bridge",
        "icon": "$(globe)"
      },
      {
        "command": "picoBridge.runFile",
        "title": "Run Current File on Pico",
        "category": "Pico Bridge",
        "icon": "$(play)"
      },
      {
        "command": "picoBridge.uploadFile",
        "title": "Upload File to Pico",
        "category": "Pico Bridge",
        "icon": "$(cloud-upload)"
      },
      {
        "command": "picoBridge.uploadProject",
        "title": "Upload Project to Pico",
        "category": "Pico Bridge",
        "icon": "$(package)"
      },
      {
        "command": "picoBridge.listFiles",
        "title": "List Files on Pico",
        "category": "Pico Bridge",
        "icon": "$(list-tree)"
      },
      {
        "command": "picoBridge.openREPL",
        "title": "Open REPL",
        "category": "Pico Bridge",
        "icon": "$(terminal)"
      },
      {
        "command": "picoBridge.showLogs",
        "title": "Show Logs",
        "category": "Pico Bridge",
        "icon": "$(output)"
      },
      {
        "command": "picoBridge.softReset",
        "title": "Soft Reset (Ctrl+D)",
        "category": "Pico Bridge"
      },
      {
        "command": "picoBridge.hardReset",
        "title": "Hard Reset",
        "category": "Pico Bridge"
      },
      {
        "command": "picoBridge.stopCode",
        "title": "Stop Running Code (Ctrl+C)",
        "category": "Pico Bridge"
      }
    ]
  }
}
```

### 5.2 Keybindings

**VS Code API Documentation Reference**: Keybindings use `when` clauses for conditional activation

```json
{
  "contributes": {
    "keybindings": [
      {
        "command": "picoBridge.runFile",
        "key": "ctrl+shift+r",
        "mac": "cmd+shift+r",
        "when": "editorLangId == python && picoBridge.serverRunning"
      },
      {
        "command": "picoBridge.uploadFile",
        "key": "ctrl+shift+u",
        "mac": "cmd+shift+u",
        "when": "editorLangId == python && picoBridge.serverRunning"
      },
      {
        "command": "picoBridge.stopCode",
        "key": "ctrl+shift+c",
        "mac": "cmd+shift+c",
        "when": "picoBridge.serverRunning"
      }
    ]
  }
}
```

### 5.3 Menu Contributions

**VS Code API Documentation Reference**: Menu items use same `when` clause syntax

```json
{
  "contributes": {
    "menus": {
      "commandPalette": [
        {
          "command": "picoBridge.startServer",
          "when": "!picoBridge.serverRunning"
        },
        {
          "command": "picoBridge.stopServer",
          "when": "picoBridge.serverRunning"
        },
        {
          "command": "picoBridge.openBrowser",
          "when": "picoBridge.serverRunning"
        },
        {
          "command": "picoBridge.runFile",
          "when": "editorLangId == python && picoBridge.serverRunning"
        },
        {
          "command": "picoBridge.uploadFile",
          "when": "editorLangId == python && picoBridge.serverRunning"
        }
      ],
      "editor/context": [
        {
          "command": "picoBridge.runFile",
          "when": "editorLangId == python && picoBridge.serverRunning",
          "group": "picoBridge@1"
        },
        {
          "command": "picoBridge.uploadFile",
          "when": "editorLangId == python && picoBridge.serverRunning",
          "group": "picoBridge@2"
        }
      ],
      "explorer/context": [
        {
          "command": "picoBridge.runFile",
          "when": "resourceExtname == .py && picoBridge.serverRunning",
          "group": "picoBridge@1"
        },
        {
          "command": "picoBridge.uploadFile",
          "when": "resourceExtname == .py && picoBridge.serverRunning",
          "group": "picoBridge@2"
        }
      ],
      "view/title": [
        {
          "command": "picoBridge.listFiles",
          "when": "view == picoBridge.deviceExplorer",
          "group": "navigation"
        }
      ]
    }
  }
}
```

---

## Phase 6: Settings & Configuration

### 6.1 Configuration Contribution

**VS Code API Documentation Reference**: Configuration properties use JSON Schema format with `scope` for level (window, resource, etc.)

```json
{
  "contributes": {
    "configuration": {
      "title": "Pico Bridge",
      "properties": {
        "picoBridge.server.port": {
          "type": "number",
          "default": 3000,
          "minimum": 1024,
          "maximum": 65535,
          "description": "Port number for the bridge server",
          "scope": "window"
        },
        "picoBridge.server.autoStart": {
          "type": "boolean",
          "default": false,
          "description": "Automatically start the bridge server when a MicroPython project is detected",
          "scope": "window"
        },
        "picoBridge.serial.baudRate": {
          "type": "number",
          "default": 115200,
          "enum": [9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600],
          "description": "Default baud rate for serial communication",
          "scope": "window"
        },
        "picoBridge.pty.linkPath": {
          "type": "string",
          "default": "/tmp/picoUSB",
          "description": "Path for the virtual serial port symlink",
          "scope": "window"
        },
        "picoBridge.ui.showTimestamps": {
          "type": "boolean",
          "default": false,
          "description": "Show timestamps in serial output",
          "scope": "window"
        },
        "picoBridge.project.excludeFolders": {
          "type": "array",
          "default": ["examples", ".git", "__pycache__"],
          "items": {
            "type": "string"
          },
          "description": "Folders to exclude when uploading project",
          "scope": "resource"
        },
        "picoBridge.browser.customCommand": {
          "type": "string",
          "default": "",
          "description": "Custom browser command (leave empty for system default). Example: 'google-chrome --incognito'",
          "scope": "window"
        }
      }
    }
  }
}
```

### 6.2 Configuration Reader

```typescript
import * as vscode from 'vscode';

export interface PicoBridgeConfig {
    server: {
        port: number;
        autoStart: boolean;
    };
    serial: {
        baudRate: number;
    };
    pty: {
        linkPath: string;
    };
    ui: {
        showTimestamps: boolean;
    };
    project: {
        excludeFolders: string[];
    };
    browser: {
        customCommand: string;
    };
}

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
            excludeFolders: config.get<string[]>('project.excludeFolders', ['examples'])
        },
        browser: {
            customCommand: config.get<string>('browser.customCommand', '')
        }
    };
}
```

---

## Phase 7: Views & Activity Bar

### 7.1 Activity Bar Container

**VS Code API Documentation Reference**: viewsContainers define custom sidebar containers with icons

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "picoBridge",
          "title": "Pico Bridge",
          "icon": "media/icons/pico-activity.svg"
        }
      ]
    }
  }
}
```

### 7.2 Views

```json
{
  "contributes": {
    "views": {
      "picoBridge": [
        {
          "id": "picoBridge.status",
          "name": "Connection Status",
          "contextualTitle": "Pico Bridge Status"
        },
        {
          "id": "picoBridge.deviceExplorer",
          "name": "Device Files",
          "contextualTitle": "Pico Device Explorer"
        },
        {
          "id": "picoBridge.workspaceFiles",
          "name": "Project Files",
          "contextualTitle": "MicroPython Project"
        }
      ]
    }
  }
}
```

### 7.3 Welcome Views

**VS Code API Documentation Reference**: viewsWelcome provides guidance when views are empty

```json
{
  "contributes": {
    "viewsWelcome": [
      {
        "view": "picoBridge.status",
        "contents": "No Pico connected.\n[Start Bridge Server](command:picoBridge.startServer)\n\nAfter starting the server, open the browser and connect your Pico device using the Web Serial API.",
        "when": "!picoBridge.serverRunning"
      },
      {
        "view": "picoBridge.status",
        "contents": "Bridge server is running.\n[Open in Browser](command:picoBridge.openBrowser)\n[Stop Server](command:picoBridge.stopServer)",
        "when": "picoBridge.serverRunning"
      },
      {
        "view": "picoBridge.deviceExplorer",
        "contents": "Connect to your Pico device in the browser to view files.\n[Open Browser](command:picoBridge.openBrowser)",
        "when": "picoBridge.serverRunning && !picoBridge.deviceConnected"
      }
    ]
  }
}
```

### 7.4 Tree View Provider

**VS Code API Documentation Reference**: TreeDataProvider implements `getTreeItem()` and `getChildren()`

```typescript
import * as vscode from 'vscode';

export class PicoExplorerProvider implements vscode.TreeDataProvider<PicoFileItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<PicoFileItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private files: PicoFileItem[] = [];
    
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
    
    updateFiles(files: string[]): void {
        this.files = files.map(f => new PicoFileItem(f));
        this.refresh();
    }
    
    getTreeItem(element: PicoFileItem): vscode.TreeItem {
        return element;
    }
    
    getChildren(element?: PicoFileItem): Thenable<PicoFileItem[]> {
        if (!element) {
            return Promise.resolve(this.files);
        }
        return Promise.resolve([]);
    }
}

class PicoFileItem extends vscode.TreeItem {
    constructor(
        public readonly filename: string
    ) {
        super(filename, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = `File: ${filename}`;
        this.contextValue = filename.endsWith('.py') ? 'pythonFile' : 'file';
        
        // Set icon based on file type
        if (filename.endsWith('.py')) {
            this.iconPath = new vscode.ThemeIcon('file-code');
        } else {
            this.iconPath = new vscode.ThemeIcon('file');
        }
    }
}
```

---

## Phase 8: Icons & Branding

### 8.1 Required Icons

**VS Code API Documentation Reference**: Extension icon must be 128x128 PNG

| Icon | Size | Format | Purpose |
|------|------|--------|---------|
| `icon.png` | 128x128 | PNG | Marketplace icon |
| `logo.png` | 256x256 | PNG | Extension logo |
| `pico-activity.svg` | 24x24 | SVG | Activity bar icon |
| `pico-light.svg` | 16x16 | SVG | Tree item icon (light) |
| `pico-dark.svg` | 16x16 | SVG | Tree item icon (dark) |

### 8.2 Icon Design Guidelines

Based on the existing branding (Raspberry Pi Pico red color #e30b5d):

```svg
<!-- media/icons/pico-activity.svg -->
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Pico board shape -->
  <rect x="4" y="6" width="16" height="12" rx="2" fill="currentColor"/>
  <!-- GPIO pins representation -->
  <circle cx="7" cy="9" r="1" fill="#fff"/>
  <circle cx="17" cy="9" r="1" fill="#fff"/>
  <circle cx="7" cy="15" r="1" fill="#fff"/>
  <circle cx="17" cy="15" r="1" fill="#fff"/>
  <!-- Chip -->
  <rect x="10" y="10" width="4" height="4" fill="#fff"/>
</svg>
```

### 8.3 Gallery Banner

```json
{
  "galleryBanner": {
    "color": "#e30b5d",
    "theme": "dark"
  }
}
```

---

## Phase 9: Documentation

### 9.1 README.md (Marketplace)

**VS Code API Documentation Reference**: README is displayed on the marketplace page

Structure:
1. **Hero Image** - Screenshot of extension in action
2. **Features** - Key features with GIFs
3. **Requirements** - Browser requirements (Chrome/Edge), Codespaces
4. **Quick Start** - 3-step getting started
5. **Commands** - Table of all commands
6. **Settings** - Table of all settings
7. **Known Issues** - Browser compatibility notes
8. **Release Notes** - Link to CHANGELOG

### 9.2 CHANGELOG.md

**VS Code API Documentation Reference**: CHANGELOG is displayed on marketplace under "Changelog" tab

```markdown
# Changelog

All notable changes to the "Pico Bridge" extension will be documented in this file.

## [1.0.0] - 2024-XX-XX

### Added
- Initial release
- Bridge server management
- Web Serial API integration via external browser
- Status bar integration
- Activity bar view with device explorer
- Commands for file upload and execution
- Configurable settings
- Walkthrough for new users
```

### 9.3 Walkthrough

**VS Code API Documentation Reference**: Walkthroughs provide interactive onboarding

```json
{
  "contributes": {
    "walkthroughs": [
      {
        "id": "picoBridge.gettingStarted",
        "title": "Getting Started with Pico Bridge",
        "description": "Learn how to connect your Raspberry Pi Pico to GitHub Codespaces",
        "steps": [
          {
            "id": "picoBridge.start",
            "title": "Start the Bridge Server",
            "description": "Click the button below to start the Pico Bridge server.\n\n[Start Server](command:picoBridge.startServer)",
            "media": {
              "image": "media/walkthrough/start-server.png",
              "altText": "Starting the bridge server"
            },
            "completionEvents": ["onCommand:picoBridge.startServer"]
          },
          {
            "id": "picoBridge.connect",
            "title": "Connect Your Pico",
            "description": "The bridge will open in your browser. Click 'Connect Pico' and select your device from the list.\n\n**Important**: Use Chrome or Edge browser for Web Serial API support.",
            "media": {
              "image": "media/walkthrough/connect-pico.png",
              "altText": "Connecting to Pico in browser"
            }
          },
          {
            "id": "picoBridge.runCode",
            "title": "Run Your First Script",
            "description": "Open a Python file and run it on your Pico!\n\n[Run Current File](command:picoBridge.runFile)",
            "media": {
              "image": "media/walkthrough/run-code.png",
              "altText": "Running code on Pico"
            },
            "completionEvents": ["onCommand:picoBridge.runFile"]
          },
          {
            "id": "picoBridge.upload",
            "title": "Upload Your Project",
            "description": "Upload files to your Pico's filesystem for persistent storage.\n\n[Upload Project](command:picoBridge.uploadProject)",
            "media": {
              "image": "media/walkthrough/upload-project.png",
              "altText": "Uploading project to Pico"
            },
            "completionEvents": ["onCommand:picoBridge.uploadProject"]
          }
        ]
      }
    ]
  }
}
```

---

## Phase 10: Testing

### 10.1 Test Structure

**VS Code API Documentation Reference**: Use `@vscode/test-electron` for integration testing

```typescript
// test/suite/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('benpaddlejones.pico-bridge'));
    });

    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension('benpaddlejones.pico-bridge');
        await ext?.activate();
        assert.ok(ext?.isActive);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        assert.ok(commands.includes('picoBridge.startServer'));
        assert.ok(commands.includes('picoBridge.stopServer'));
        assert.ok(commands.includes('picoBridge.openBrowser'));
        assert.ok(commands.includes('picoBridge.runFile'));
        assert.ok(commands.includes('picoBridge.uploadFile'));
    });
});
```

### 10.2 Launch Configuration for Testing

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/extension"
      ],
      "outFiles": [
        "${workspaceFolder}/extension/out/**/*.js"
      ],
      "preLaunchTask": "npm: watch"
    },
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/extension",
        "--extensionTestsPath=${workspaceFolder}/extension/out/test/suite/index"
      ],
      "outFiles": [
        "${workspaceFolder}/extension/out/**/*.js"
      ],
      "preLaunchTask": "npm: watch"
    }
  ]
}
```

---

## Phase 11: Packaging & Publishing

### 11.1 .vscodeignore

**VS Code API Documentation Reference**: Exclude unnecessary files from VSIX package

```
.vscode/**
.vscode-test/**
src/**
test/**
node_modules/**
!node_modules/express/**
!node_modules/socket.io/**
.gitignore
.eslintrc.json
tsconfig.json
webpack.config.js
**/*.map
**/*.ts
```

### 11.2 Bundling with Webpack

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
    target: 'node',
    mode: 'none',
    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'out'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2'
    },
    externals: {
        vscode: 'commonjs vscode'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: ['ts-loader']
            }
        ]
    }
};
```

### 11.3 Publishing Checklist

1. **Create Publisher Account**
   - Go to https://marketplace.visualstudio.com/manage
   - Create publisher ID: `benpaddlejones`

2. **Generate Personal Access Token**
   - Azure DevOps > User Settings > Personal Access Tokens
   - Scope: Marketplace (Publish)

3. **Package Extension**
   ```bash
   cd extension
   npm run package
   vsce package
   ```

4. **Publish**
   ```bash
   vsce publish
   # or for specific version
   vsce publish 1.0.0
   ```

---

## Verification Checklist

### Extension Manifest Verification

| Requirement | Field | Status |
|-------------|-------|--------|
| Name (lowercase, no spaces) | `name` | ⬜ |
| Display name | `displayName` | ⬜ |
| Version (semver) | `version` | ⬜ |
| Publisher ID | `publisher` | ⬜ |
| VS Code engine version | `engines.vscode` | ⬜ |
| Entry point | `main` | ⬜ |
| Activation events | `activationEvents` | ⬜ |
| Categories (valid values) | `categories` | ⬜ |
| Icon (128x128 PNG) | `icon` | ⬜ |
| Repository URL | `repository` | ⬜ |
| License | `license` | ⬜ |

### API Compliance Verification

| Requirement | API Method | Verified |
|-------------|------------|----------|
| External browser (NOT webview) | `vscode.env.openExternal()` | ⬜ |
| Port forwarding in Codespaces | `vscode.env.asExternalUri()` | ⬜ |
| Status bar item | `window.createStatusBarItem()` | ⬜ |
| Output channel | `window.createOutputChannel()` | ⬜ |
| Command registration | `commands.registerCommand()` | ⬜ |
| Tree view | `window.registerTreeDataProvider()` | ⬜ |
| Context keys | `commands.executeCommand('setContext')` | ⬜ |
| Configuration access | `workspace.getConfiguration()` | ⬜ |
| Disposable management | `context.subscriptions.push()` | ⬜ |

### Documentation Verification

| Document | Content | Status |
|----------|---------|--------|
| README.md | Features, requirements, usage | ⬜ |
| CHANGELOG.md | Version history | ⬜ |
| LICENSE | MIT license text | ⬜ |
| Walkthrough | 4+ step onboarding | ⬜ |
| Inline help | Tooltips, descriptions | ⬜ |

### Testing Verification

| Test Type | Coverage | Status |
|-----------|----------|--------|
| Unit tests | Core functions | ⬜ |
| Integration tests | Commands, views | ⬜ |
| Manual testing | All user flows | ⬜ |
| Codespaces testing | Port forwarding | ⬜ |
| Browser testing | Chrome, Edge | ⬜ |

---

## Implementation Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Structure | 1 day | None |
| Phase 2: Manifest | 0.5 day | Phase 1 |
| Phase 3: Core | 3 days | Phase 2 |
| Phase 4: UI/UX | 2 days | Phase 3 |
| Phase 5: Commands | 1 day | Phase 3 |
| Phase 6: Settings | 0.5 day | Phase 3 |
| Phase 7: Views | 2 days | Phase 4 |
| Phase 8: Icons | 1 day | Phase 7 |
| Phase 9: Docs | 2 days | Phase 8 |
| Phase 10: Testing | 2 days | Phase 9 |
| Phase 11: Publish | 1 day | Phase 10 |

**Total Estimated Time: 16 days**

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Web Serial API not in webview | HIGH | Use `vscode.env.openExternal()` - VERIFIED |
| Codespaces port forwarding | MEDIUM | Use `vscode.env.asExternalUri()` - VERIFIED |
| Node.js server in extension | LOW | Bundle server code, spawn as child process |
| Cross-platform compatibility | LOW | Extension runs in Codespaces (Linux) |
| Browser compatibility | MEDIUM | Document Chrome/Edge requirement clearly |

---

## Next Steps

1. ✅ Create this planning document
2. ⬜ Create extension directory structure
3. ⬜ Initialize npm project with TypeScript
4. ⬜ Implement core extension.ts
5. ⬜ Integrate existing bridge server
6. ⬜ Implement commands
7. ⬜ Create icons and branding
8. ⬜ Write documentation
9. ⬜ Test thoroughly
10. ⬜ Publish to marketplace
