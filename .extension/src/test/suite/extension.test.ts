/**
 * Extension Test Suite
 *
 * Basic tests for the Pico Bridge extension
 */

import * as assert from "assert";
import * as vscode from "vscode";

// Extension ID follows the pattern: publisher.name
const EXTENSION_ID = "benpaddlejones.pico-bridge";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Starting Pico Bridge tests");

  test("Extension should be present", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `Extension ${EXTENSION_ID} should be installed`);
  });

  test("Extension should activate", async function () {
    // Increase timeout for activation
    this.timeout(10000);

    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `Extension ${EXTENSION_ID} should be installed`);

    if (ext && !ext.isActive) {
      await ext.activate();
    }
    assert.ok(ext?.isActive, "Extension should be active");
  });

  test("Commands should be registered", async function () {
    this.timeout(5000);

    const commands = await vscode.commands.getCommands(true);

    const expectedCommands = [
      "picoBridge.startServer",
      "picoBridge.stopServer",
      "picoBridge.openBrowser",
      "picoBridge.runFile",
      "picoBridge.uploadFile",
      "picoBridge.uploadProject",
      "picoBridge.showLogs",
      "picoBridge.softReset",
      "picoBridge.hardReset",
      "picoBridge.stopCode",
      "picoBridge.createProject",
      "picoBridge.setupExistingProject",
    ];

    for (const cmd of expectedCommands) {
      assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
    }
  });

  test("Configuration should have defaults", () => {
    const config = vscode.workspace.getConfiguration("picoBridge");

    // Check default values
    assert.strictEqual(
      config.get("server.port"),
      3000,
      "Default port should be 3000"
    );
    assert.strictEqual(
      config.get("server.autoStart"),
      false,
      "Auto-start should be false by default"
    );
    assert.strictEqual(
      config.get("serial.baudRate"),
      115200,
      "Default baud rate should be 115200"
    );
  });
});
