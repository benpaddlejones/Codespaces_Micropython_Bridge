/**
 * Bridge Tools View Provider
 *
 * Displays tools and utilities in the Pico Bridge sidebar.
 */

import * as vscode from "vscode";

interface ToolItem extends vscode.TreeItem {
  children?: ToolItem[];
}

export class BridgeToolsProvider
  implements vscode.TreeDataProvider<ToolItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    ToolItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ToolItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ToolItem): Thenable<ToolItem[]> {
    if (element) {
      return Promise.resolve(element.children || []);
    }

    const items: ToolItem[] = [];

    // === TOOLS SECTION ===
    // Open Emulator button
    const emulatorItem = new vscode.TreeItem(
      "Open Emulator",
      vscode.TreeItemCollapsibleState.None
    ) as ToolItem;
    emulatorItem.iconPath = new vscode.ThemeIcon("circuit-board");
    emulatorItem.tooltip = "Test MicroPython code without hardware";
    emulatorItem.command = {
      command: "picoBridge.openEmulator",
      title: "Open Emulator",
    };
    items.push(emulatorItem);

    // Add Sample Scripts button
    const samplesItem = new vscode.TreeItem(
      "Add Sample Scripts",
      vscode.TreeItemCollapsibleState.None
    ) as ToolItem;
    samplesItem.iconPath = new vscode.ThemeIcon("file-code");
    samplesItem.tooltip = "Add sample MicroPython scripts to your project";
    samplesItem.command = {
      command: "picoBridge.addSampleScripts",
      title: "Add Sample Scripts",
    };
    items.push(samplesItem);

    // Separator
    const sep1 = new vscode.TreeItem(
      "───────────────",
      vscode.TreeItemCollapsibleState.None
    ) as ToolItem;
    items.push(sep1);

    // === PROJECT SECTION ===
    // Create Basic Project button
    const basicProjectItem = new vscode.TreeItem(
      "Create Basic Project",
      vscode.TreeItemCollapsibleState.None
    ) as ToolItem;
    basicProjectItem.iconPath = new vscode.ThemeIcon("new-folder");
    basicProjectItem.tooltip =
      "Create a project folder with empty lib/ and main.py";
    basicProjectItem.command = {
      command: "picoBridge.createBasicProject",
      title: "Create Basic Project",
    };
    items.push(basicProjectItem);

    // Create Project with Adv Debugging button
    const advancedProjectItem = new vscode.TreeItem(
      "Create Project with Adv Debugging",
      vscode.TreeItemCollapsibleState.None
    ) as ToolItem;
    advancedProjectItem.iconPath = new vscode.ThemeIcon("beaker");
    advancedProjectItem.tooltip = "Create a project with debugging support (lib/launcher, config.py, py_scripts)";
    advancedProjectItem.command = {
      command: "picoBridge.createProject",
      title: "Create Project with Adv Debugging",
    };
    items.push(advancedProjectItem);

    // Setup Existing Project button
    const setupProjectItem = new vscode.TreeItem(
      "Setup Existing Project",
      vscode.TreeItemCollapsibleState.None
    ) as ToolItem;
    setupProjectItem.iconPath = new vscode.ThemeIcon("folder");
    setupProjectItem.tooltip =
      "Mark an existing folder as a MicroPython project";
    setupProjectItem.command = {
      command: "picoBridge.setupExistingProject",
      title: "Setup Existing Project",
    };
    items.push(setupProjectItem);

    // Separator
    const sep2 = new vscode.TreeItem(
      "───────────────",
      vscode.TreeItemCollapsibleState.None
    ) as ToolItem;
    items.push(sep2);

    // === DOCUMENTATION SECTION ===
    // MicroPython Docs
    const microPythonDocsItem = new vscode.TreeItem(
      "MicroPython Docs",
      vscode.TreeItemCollapsibleState.None
    ) as ToolItem;
    microPythonDocsItem.iconPath = new vscode.ThemeIcon("book");
    microPythonDocsItem.tooltip = "Open MicroPython Documentation";
    microPythonDocsItem.command = {
      command: "picoBridge.openMicroPythonDocs",
      title: "MicroPython Docs",
    };
    items.push(microPythonDocsItem);

    // Debugpy Integration Documentation
    const debugpyDocsItem = new vscode.TreeItem(
      "Debugpy Integration Docs",
      vscode.TreeItemCollapsibleState.None
    ) as ToolItem;
    debugpyDocsItem.iconPath = new vscode.ThemeIcon("bug");
    debugpyDocsItem.tooltip = "Debugpy Integration Documentation";
    debugpyDocsItem.command = {
      command: "picoBridge.openDebugpyDocs",
      title: "Debugpy Integration Docs",
    };
    items.push(debugpyDocsItem);

    // Emulator Documentation
    const emulatorDocsItem = new vscode.TreeItem(
      "Emulator Documentation",
      vscode.TreeItemCollapsibleState.None
    ) as ToolItem;
    emulatorDocsItem.iconPath = new vscode.ThemeIcon("desktop-download");
    emulatorDocsItem.tooltip = "Emulator Documentation";
    emulatorDocsItem.command = {
      command: "picoBridge.openEmulatorDocs",
      title: "Emulator Documentation",
    };
    items.push(emulatorDocsItem);

    return Promise.resolve(items);
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
