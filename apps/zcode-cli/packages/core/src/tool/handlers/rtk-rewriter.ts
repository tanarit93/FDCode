// RTK（Rust Token Killer）命令改写。规格见 docs/specs/rtk-bash-rewrite.md。

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const RTK_BINARY = "rtk";
const RTK_EXEC_TIMEOUT_MS = 1_000;
const RTK_ALREADY_WRAPPED_PATTERN = /^rtk(?:\.exe)?(?:\s|$)/;
const RTK_DISABLE_ENV_KEY = "ZCODE_DISABLE_RTK";
const ENV_TRUTHY_VALUES = new Set(["1", "true"]);

export interface BashRtkPolicy {
  enabled: boolean;
}

export const DEFAULT_BASH_RTK_POLICY: BashRtkPolicy = { enabled: true };

export function resolveBashRtkPolicy(
  env: Readonly<Record<string, string | undefined>>,
): BashRtkPolicy {
  const disabled = ENV_TRUTHY_VALUES.has(env[RTK_DISABLE_ENV_KEY]?.trim().toLowerCase() ?? "");
  return { enabled: !disabled };
}

export type RtkRunner = (args: readonly string[]) => Promise<{ stdout: string }>;

export interface RtkRewriter {
  rewrite(command: string, policy: BashRtkPolicy): Promise<string>;
}

const execRtk: RtkRunner = async (args) => {
  const { stdout } = await execFileAsync(RTK_BINARY, [...args], {
    timeout: RTK_EXEC_TIMEOUT_MS,
    windowsHide: true,
  });
  return { stdout };
};

/**
 * 可用性探测结果在 rewriter 生命周期内缓存（含并发调用共享同一次探测）。
 * 探测失败、`rtk hook check` 无改写（退出码非 0）、超时都退回原命令：
 * 改写只是优化，不能让 Bash 工具因此失败。
 */
export function createRtkRewriter(run: RtkRunner): RtkRewriter {
  let availability: Promise<boolean> | undefined;

  const isAvailable = (): Promise<boolean> => {
    availability ??= run(["--version"]).then(
      ({ stdout }) => stdout.toLowerCase().includes(RTK_BINARY),
      () => false,
    );
    return availability;
  };

  return {
    async rewrite(command, policy) {
      const trimmed = command.trim();
      if (!policy.enabled || trimmed === "" || RTK_ALREADY_WRAPPED_PATTERN.test(trimmed)) {
        return command;
      }
      if (!(await isAvailable())) return command;

      try {
        const { stdout } = await run(["hook", "check", trimmed]);
        return stdout.trim() || command;
      } catch {
        return command;
      }
    },
  };
}

const defaultRewriter = createRtkRewriter(execRtk);

export function rewriteBashCommandWithRtk(command: string, policy: BashRtkPolicy): Promise<string> {
  return defaultRewriter.rewrite(command, policy);
}
