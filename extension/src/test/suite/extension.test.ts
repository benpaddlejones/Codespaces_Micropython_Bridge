/**
 * Extension Test Suite
 * 
 * Basic tests for the Pico Bridge extension
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting Pico Bridge tests');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('pico-bridge.pico-bridge'));
    });

    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension('pico-bridge.pico-bridge');
        if (ext) {
            await ext.activate();
            assert.ok(ext.isActive);
        }
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        const expectedCommands = [
            'picoBridge.startServer',
            'picoBridge.stopServer',
            'picoBridge.openBrowser',
            'picoBridge.runFile',
            'picoBridge.showLogs'
        ];

        for (const cmd of expectedCommands) {
            assert.ok(
                commands.includes(cmd),
                `Command ${cmd} should be registered`
            );
        }
    });
});
