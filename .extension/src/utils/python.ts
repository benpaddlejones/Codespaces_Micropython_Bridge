import { execFileSync } from "child_process";
import * as vscode from "vscode";

/**
 * Resolve the best Python executable to use for the emulator/debugger.
 *
 * Resolution order:
 * 1. `picoBridge.emulator.pythonExecutable` setting (explicit user override)
 * 2. The interpreter selected in the ms-python extension (if active)
 * 3. Falls back to `"python3"`
 *
 * @param resource - Optional workspace resource for per-folder interpreter resolution
 * @returns The Python executable path or name
 */
export async function resolvePythonExecutable(
  resource?: vscode.Uri,
): Promise<string> {
  // 1. Explicit user override wins
  const setting = vscode.workspace
    .getConfiguration("picoBridge.emulator")
    .get<string>("pythonExecutable", "");
  if (setting && setting.trim().length > 0) {
    return setting.trim();
  }

  // 2. Ask the ms-python extension for the currently selected interpreter
  try {
    const pythonExt = vscode.extensions.getExtension("ms-python.python");
    if (pythonExt) {
      if (!pythonExt.isActive) {
        await pythonExt.activate();
      }

      // Try the newer environments API first (Python extension ≥ 2023.x)
      const envApi = pythonExt.exports?.environments;
      if (envApi) {
        const envPath = envApi.getActiveEnvironmentPath(resource);
        if (envPath?.path) {
          return envPath.path;
        }
      }

      // Fall back to the older settings API (Python extension ≥ 2021.x)
      const settingsApi = pythonExt.exports?.settings;
      if (settingsApi) {
        const details = settingsApi.getExecutionDetails(resource);
        const cmd = details?.execCommand?.[0];
        if (cmd) {
          return cmd;
        }
      }
    }
  } catch {
    // ms-python API unavailable — fall through to default
  }

  // 3. Generic fallback
  return "python3";
}

/**
 * Validate that a Python executable exists and is runnable.
 *
 * Runs `<python> --version` to confirm the binary works. Returns a
 * descriptive error string if validation fails, or `undefined` on success.
 *
 * @param executable - The Python executable path or name to test
 * @returns An error description, or `undefined` if the executable is valid
 */
export function validatePythonExecutable(
  executable: string,
): string | undefined {
  try {
    execFileSync(executable, ["--version"], {
      timeout: 5000,
      stdio: "pipe",
    });
    return undefined; // success
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT")) {
      return `Python executable not found: "${executable}". Install Python 3 or set "picoBridge.emulator.pythonExecutable" in Settings.`;
    }
    if (msg.includes("EACCES") || msg.includes("EPERM")) {
      return `Permission denied running "${executable}". Check file permissions.`;
    }
    if (msg.includes("ETIMEDOUT")) {
      return `Timed out waiting for "${executable} --version". The Python installation may be broken.`;
    }
    return `Cannot run "${executable}": ${msg}`;
  }
}

/**
 * Resolve the Python executable and validate it is runnable, showing an
 * actionable error notification if not.
 *
 * @param resource - Optional workspace resource for per-folder interpreter resolution
 * @returns The validated executable path, or `undefined` when validation failed
 *          (the user has already been shown an error message in that case)
 */
export async function resolvePythonExecutableOrWarn(
  resource?: vscode.Uri,
): Promise<string | undefined> {
  const executable = await resolvePythonExecutable(resource);
  const error = validatePythonExecutable(executable);

  if (!error) {
    return executable;
  }

  // Show an actionable error — "Configure" opens the relevant settings page.
  vscode.window
    .showErrorMessage(error, "Configure Python Path", "Show Logs")
    .then((selection) => {
      if (selection === "Configure Python Path") {
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "picoBridge.emulator.pythonExecutable",
        );
      } else if (selection === "Show Logs") {
        vscode.commands.executeCommand("picoBridge.showLogs");
      }
    });

  return undefined;
}
