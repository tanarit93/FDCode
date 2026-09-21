// ============================================================
// RTK Command Rewriter
// Transparently optimizes terminal commands to cut LLM tokens
// ============================================================

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const RTK_EXEC_TIMEOUT_MS = 1_000;

interface RtkState {
  available: boolean | undefined;
  binaryPath: string;
}

const rtkState: RtkState = {
  available: undefined,
  binaryPath: process.env.RTK_PATH || "rtk",
};

/**
 * Reset cached RTK availability (primarily for unit tests).
 */
export function resetRtkState(): void {
  rtkState.available = undefined;
  rtkState.binaryPath = process.env.RTK_PATH || "rtk";
}

/**
 * Check if RTK auto-rewriting is disabled via environment variable.
 */
export function isRtkDisabledByEnv(): boolean {
  return (
    process.env.FDCODE_DISABLE_RTK === "1" ||
    process.env.FDCODE_DISABLE_RTK === "true" ||
    process.env.RTK_DISABLE === "1" ||
    process.env.RTK_DISABLE === "true"
  );
}

/**
 * Check if the RTK binary is installed and executable.
 * Caches the result after the initial check.
 */
export async function isRtkAvailable(): Promise<boolean> {
  if (isRtkDisabledByEnv()) {
    return false;
  }

  if (rtkState.available !== undefined) {
    return rtkState.available;
  }

  try {
    const { stdout } = await execFileAsync(rtkState.binaryPath, ["--version"], {
      timeout: RTK_EXEC_TIMEOUT_MS,
      windowsHide: true,
    });
    rtkState.available = typeof stdout === "string" && stdout.toLowerCase().includes("rtk");
  } catch {
    rtkState.available = false;
  }

  return rtkState.available;
}

/**
 * Inspects a bash command and rewrites it to its RTK token-optimized equivalent
 * if supported. Returns the original command if RTK is unavailable, disabled,
 * or if the command has no RTK equivalent.
 */
export async function rewriteBashCommandWithRtk(command: string): Promise<string> {
  const trimmed = command.trim();
  if (!trimmed) {
    return command;
  }

  // Skip if already invoking RTK directly
  if (
    trimmed.startsWith("rtk ") ||
    trimmed.startsWith("rtk.exe ") ||
    trimmed === "rtk" ||
    trimmed === "rtk.exe"
  ) {
    return command;
  }

  if (isRtkDisabledByEnv()) {
    return command;
  }

  const available = await isRtkAvailable();
  if (!available) {
    return command;
  }

  try {
    const { stdout } = await execFileAsync(
      rtkState.binaryPath,
      ["hook", "check", trimmed],
      {
        timeout: RTK_EXEC_TIMEOUT_MS,
        windowsHide: true,
      },
    );

    const rewritten = stdout?.trim();
    if (rewritten && rewritten.length > 0) {
      return rewritten;
    }
  } catch {
    // If RTK hook check fails (exit code 1 on no rewrite, timeout, or syntax error),
    // safely fallback to the original command.
  }

  return command;
}
