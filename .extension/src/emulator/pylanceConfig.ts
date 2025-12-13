/**
 * Pylance Configuration for MicroPython Emulator
 *
 * Automatically configures Pylance to recognize MicroPython type stubs,
 * eliminating import errors and providing full IntelliSense support.
 */

import * as path from "path";
import * as vscode from "vscode";
import { Logger } from "../utils";

/**
 * Configure Pylance to recognize MicroPython mock modules.
 *
 * Adds the emulator's typings folder to python.analysis.extraPaths
 * so that `import machine`, `import utime`, etc. work without errors.
 *
 * @param context - Extension context containing extension path
 * @param logger - Logger instance for debugging
 */
export async function configurePylanceForMock(
  context: vscode.ExtensionContext,
  logger: Logger
): Promise<void> {
  try {
    // Path to type stubs bundled in the extension
    const typingsPath = path.join(
      context.extensionPath,
      "emulator",
      "mock",
      "typings"
    );

    // Path to runtime mock modules (for actual execution)
    const micropythonPath = path.join(
      context.extensionPath,
      "emulator",
      "mock",
      "micropython"
    );

    logger.info(`Configuring Pylance for MicroPython mock...`);
    logger.info(`  Typings path: ${typingsPath}`);
    logger.info(`  MicroPython path: ${micropythonPath}`);

    // Get current python.analysis configuration
    const config = vscode.workspace.getConfiguration("python.analysis");
    const currentExtraPaths = config.get<string[]>("extraPaths") || [];

    // Paths to add for Pylance
    const pathsToAdd = [typingsPath, micropythonPath];

    // Build new extraPaths array, avoiding duplicates
    const newExtraPaths = [...currentExtraPaths];
    let pathsAdded = false;

    for (const p of pathsToAdd) {
      if (!newExtraPaths.includes(p)) {
        newExtraPaths.push(p);
        pathsAdded = true;
        logger.info(`  Adding to extraPaths: ${p}`);
      } else {
        logger.info(`  Already in extraPaths: ${p}`);
      }
    }

    // Only update if we added new paths
    if (pathsAdded) {
      await config.update(
        "extraPaths",
        newExtraPaths,
        vscode.ConfigurationTarget.Workspace
      );
      logger.info(
        `Pylance configured successfully. MicroPython imports will now work.`
      );
    } else {
      logger.info(`Pylance already configured for MicroPython mock.`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to configure Pylance: ${errorMessage}`);
    // Don't throw - this is a convenience feature, not critical
  }
}

/**
 * Remove MicroPython mock paths from Pylance configuration.
 *
 * Call this when the extension is deactivated to clean up.
 *
 * @param context - Extension context containing extension path
 * @param logger - Logger instance for debugging
 */
export async function removePylanceConfig(
  context: vscode.ExtensionContext,
  logger: Logger
): Promise<void> {
  try {
    const typingsPath = path.join(
      context.extensionPath,
      "emulator",
      "mock",
      "typings"
    );
    const micropythonPath = path.join(
      context.extensionPath,
      "emulator",
      "mock",
      "micropython"
    );

    const config = vscode.workspace.getConfiguration("python.analysis");
    const currentExtraPaths = config.get<string[]>("extraPaths") || [];

    // Filter out our paths
    const pathsToRemove = [typingsPath, micropythonPath];
    const newExtraPaths = currentExtraPaths.filter(
      (p) => !pathsToRemove.includes(p)
    );

    if (newExtraPaths.length !== currentExtraPaths.length) {
      await config.update(
        "extraPaths",
        newExtraPaths.length > 0 ? newExtraPaths : undefined,
        vscode.ConfigurationTarget.Workspace
      );
      logger.info(`Pylance configuration cleaned up.`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to clean up Pylance config: ${errorMessage}`);
  }
}
