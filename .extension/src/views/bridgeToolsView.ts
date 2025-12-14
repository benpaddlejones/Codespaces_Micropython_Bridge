/**
 * Bridge Tools View Provider
 *
 * Displays tools and utilities in the Pico Bridge sidebar.
 * All items are FLAT - no parent-child relationships.
 *
 * Sections:
 * - Tools: Open Emulator, Add Sample Scripts
 * - Project: Create Basic/Advanced Project, Setup Existing, Switch Active Project
 * - Documentation: MicroPython Docs, Debugpy Docs, Emulator Docs
 *
 * The Switch Active Project command allows users to switch between multiple
 * MicroPython projects. Only one project can be active at a time (has .micropico),
 * while inactive projects have .micropico.inactive markers.
 */

import * as vscode from "vscode";

export class BridgeToolsProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private items: vscode.TreeItem[] = [];

  constructor() {
    this.buildItems();
  }

  private buildItems(): void {
    this.items = [];

    // === TOOLS SECTION ===
    const emulatorItem = new vscode.TreeItem(
      "Open Emulator",
      vscode.TreeItemCollapsibleState.None
    );
    emulatorItem.id = "tool-emulator";
    emulatorItem.iconPath = new vscode.ThemeIcon("circuit-board");
    emulatorItem.tooltip = "Test MicroPython code without hardware";
    emulatorItem.command = {
      command: "picoBridge.openEmulator",
      title: "Open Emulator",
    };
    this.items.push(emulatorItem);

    const samplesItem = new vscode.TreeItem(
      "Add Sample Scripts",
      vscode.TreeItemCollapsibleState.None
    );
    samplesItem.id = "tool-samples";
    samplesItem.iconPath = new vscode.ThemeIcon("file-code");
    samplesItem.tooltip = "Add sample MicroPython scripts to your project";
    samplesItem.command = {
      command: "picoBridge.addSampleScripts",
      title: "Add Sample Scripts",
    };
    this.items.push(samplesItem);

    const sep1 = new vscode.TreeItem(
      "───────────────",
      vscode.TreeItemCollapsibleState.None
    );
    sep1.id = "sep-1";
    sep1.iconPath = new vscode.ThemeIcon("blank"); // Empty icon for alignment
    this.items.push(sep1);

    // === PROJECT SECTION ===
    const basicItem = new vscode.TreeItem(
      "Create Basic Project",
      vscode.TreeItemCollapsibleState.None
    );
    basicItem.id = "proj-basic";
    basicItem.iconPath = new vscode.ThemeIcon("new-folder");
    basicItem.tooltip = "Create a project folder with empty lib/ and main.py";
    basicItem.command = {
      command: "picoBridge.createBasicProject",
      title: "Create Basic Project",
    };
    this.items.push(basicItem);

    const advItem = new vscode.TreeItem(
      "Create Project with Adv Debugging",
      vscode.TreeItemCollapsibleState.None
    );
    advItem.id = "proj-advanced";
    advItem.iconPath = new vscode.ThemeIcon("beaker");
    advItem.tooltip =
      "Create a project with debugging support (lib/launcher, config.py, py_scripts)";
    advItem.command = {
      command: "picoBridge.createProject",
      title: "Create Project with Adv Debugging",
    };
    this.items.push(advItem);

    const setupItem = new vscode.TreeItem(
      "Setup Existing Project",
      vscode.TreeItemCollapsibleState.None
    );
    setupItem.id = "proj-setup";
    setupItem.iconPath = new vscode.ThemeIcon("folder-opened");
    setupItem.tooltip = "Mark an existing folder as a MicroPython project";
    setupItem.command = {
      command: "picoBridge.setupExistingProject",
      title: "Setup Existing Project",
    };
    this.items.push(setupItem);

    const switchItem = new vscode.TreeItem(
      "Switch Active Project",
      vscode.TreeItemCollapsibleState.None
    );
    switchItem.id = "proj-switch";
    switchItem.iconPath = new vscode.ThemeIcon("folder-active");
    switchItem.tooltip = "Choose which project folder is active";
    switchItem.command = {
      command: "picoBridge.switchProject",
      title: "Switch Active Project",
    };
    this.items.push(switchItem);

    const sep2 = new vscode.TreeItem(
      "───────────────",
      vscode.TreeItemCollapsibleState.None
    );
    sep2.id = "sep-2";
    sep2.iconPath = new vscode.ThemeIcon("blank"); // Empty icon for alignment
    this.items.push(sep2);

    // === DOCUMENTATION SECTION ===
    const mpDocsItem = new vscode.TreeItem(
      "MicroPython Docs",
      vscode.TreeItemCollapsibleState.None
    );
    mpDocsItem.id = "docs-micropython";
    mpDocsItem.iconPath = new vscode.ThemeIcon("book");
    mpDocsItem.tooltip = "Open MicroPython Documentation";
    mpDocsItem.command = {
      command: "picoBridge.openMicroPythonDocs",
      title: "MicroPython Docs",
    };
    this.items.push(mpDocsItem);

    const debugpyDocsItem = new vscode.TreeItem(
      "Debugpy Integration Docs",
      vscode.TreeItemCollapsibleState.None
    );
    debugpyDocsItem.id = "docs-debugpy";
    debugpyDocsItem.iconPath = new vscode.ThemeIcon("bug");
    debugpyDocsItem.tooltip = "Debugpy Integration Documentation";
    debugpyDocsItem.command = {
      command: "picoBridge.openDebugpyDocs",
      title: "Debugpy Integration Docs",
    };
    this.items.push(debugpyDocsItem);

    const emulatorDocsItem = new vscode.TreeItem(
      "Emulator Documentation",
      vscode.TreeItemCollapsibleState.None
    );
    emulatorDocsItem.id = "docs-emulator";
    emulatorDocsItem.iconPath = new vscode.ThemeIcon("desktop-download");
    emulatorDocsItem.tooltip = "Emulator Documentation";
    emulatorDocsItem.command = {
      command: "picoBridge.openEmulatorDocs",
      title: "Emulator Documentation",
    };
    this.items.push(emulatorDocsItem);
  }

  refresh(): void {
    this.buildItems();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getParent(_element: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem> {
    return null;
  }

  getChildren(
    element?: vscode.TreeItem
  ): vscode.ProviderResult<vscode.TreeItem[]> {
    if (element) {
      return [];
    }
    return this.items;
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
