/**
 * Test Runner
 *
 * Downloads and runs VS Code with the extension loaded for testing
 */

import {
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath,
  runTests,
} from "@vscode/test-electron";
import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Try the official CLI install first. In Codespaces it often short-circuits
 * with "already installed" because it sees the dependency in the host's
 * `~/.vscode-remote/extensions` dir, but does NOT copy it into our sandbox
 * `--extensions-dir`. So we follow up with a symlink fallback.
 */
function cliInstall(
  cliPath: string,
  userDataDir: string,
  extensionsDir: string,
  ext: string,
): void {
  cp.spawnSync(
    cliPath,
    [
      "--user-data-dir",
      userDataDir,
      "--extensions-dir",
      extensionsDir,
      "--install-extension",
      ext,
      "--force",
    ],
    { encoding: "utf-8", stdio: "inherit" },
  );
}

/**
 * Look for a previously-installed copy of `extId` in common VS Code extension
 * directories. Returns the absolute path to the extension folder, or null.
 */
function findExistingExtensionDir(extId: string): string | null {
  const home = os.homedir();
  const candidates = [
    path.join(home, ".vscode-remote", "extensions"),
    path.join(home, ".vscode-server", "extensions"),
    path.join(home, ".vscode", "extensions"),
  ];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir);
    const match = entries.find((e) => e.startsWith(`${extId}-`));
    if (match) return path.join(dir, match);
  }
  return null;
}

/**
 * Ensure the extensions declared in `extensionDependencies` are present in the
 * sandboxed `extensionsDir` the test host will load from. Required because
 * VS Code refuses to activate an extension whose declared dependencies are
 * missing.
 */
function ensureDependencyExtensions(
  vscodeExecutablePath: string,
  userDataDir: string,
  extensionsDir: string,
): void {
  const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);
  fs.mkdirSync(extensionsDir, { recursive: true });

  const dependencies = ["ms-python.python"];

  for (const ext of dependencies) {
    cliInstall(cliPath, userDataDir, extensionsDir, ext);

    // Did the CLI actually drop the extension in our sandbox?
    const sandboxEntries = fs.readdirSync(extensionsDir);
    const present = sandboxEntries.some((e) => e.startsWith(`${ext}-`));
    if (present) continue;

    // Fall back to linking from an existing install (Codespaces case).
    const existing = findExistingExtensionDir(ext);
    if (!existing) {
      throw new Error(
        `Dependency extension '${ext}' could not be installed and no existing copy was found.`,
      );
    }
    const dest = path.join(extensionsDir, path.basename(existing));
    try {
      fs.symlinkSync(existing, dest, "dir");
    } catch (err) {
      // EEXIST or filesystem doesn't support symlinks — try a recursive copy.
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        fs.cpSync(existing, dest, { recursive: true });
      }
    }
    console.log(`[test] Linked ${ext} from ${existing} -> ${dest}`);
  }
}

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // The path to test runner
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    // Shared, persistent dirs so installed dependency extensions are visible
    // to the test host (otherwise runTests creates its own throwaway dirs and
    // never sees our --install-extension result).
    const testHome = path.resolve(extensionDevelopmentPath, ".vscode-test");
    const userDataDir = path.join(testHome, "user-data");
    const extensionsDir = path.join(testHome, "extensions");

    // Download VS Code once so we can both install deps into it and run tests.
    const vscodeExecutablePath = await downloadAndUnzipVSCode();
    ensureDependencyExtensions(
      vscodeExecutablePath,
      userDataDir,
      extensionsDir,
    );

    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        "--user-data-dir",
        userDataDir,
        "--extensions-dir",
        extensionsDir,
      ],
    });
  } catch (err) {
    console.error("Failed to run tests", err);
    process.exit(1);
  }
}

main();
