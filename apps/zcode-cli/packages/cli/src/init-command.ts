import { join } from "node:path";
import * as readline from "node:readline/promises";
import { getDefaultConfigPath } from "@zcode/adapters/config";
import { getZCodeCopy, type InitCopy } from "@zcode/i18n";
import type { GlobalOptions, RunContext } from "@zcode/shared-types";
import type { RunDependencies } from "./cli-types.js";
import {
  ENV_KEY_API_KEY,
  ENV_KEY_BASE_URL,
  ENV_KEY_MODEL,
  InvalidEnvValueError,
  InvalidExistingConfigError,
  ensureEnvGitignored,
  upsertEnvEntries,
  writeUserProviderConfig,
} from "./init-config-writers.js";
import { NO_API_KEY_PLACEHOLDER, PROVIDER_PRESETS, type ProviderPreset } from "./init-presets.js";

const PROBE_TIMEOUT_MS = 3_000;
const SAVE_TARGET_GLOBAL = "2";
const ENV_FILE_NAME = ".env";
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

export interface InitCommandOverrides {
  /** 用户级配置文件路径，默认取 CLI 的用户配置位置。 */
  userConfigPath?: string;
}

class InvalidBaseUrlError extends Error {
  readonly value: string;

  constructor(value: string) {
    super(`Invalid base URL: ${value}`);
    this.name = "InvalidBaseUrlError";
    this.value = value;
  }
}

type ProbeResult = "connected" | "no-models-endpoint" | "unreachable";

/** 规格见 docs/specs/fdcode-init-wizard.md。 */
export async function runInitCommand(
  ctx: RunContext,
  options: GlobalOptions,
  deps: RunDependencies,
  overrides: InitCommandOverrides = {},
): Promise<number> {
  const copy = getZCodeCopy(options.locale, options.detectedLocale).cli.init;

  if (!ctx.stdin.isTTY) {
    ctx.stderr.write(`${copy.nonInteractive}\n`);
    return 1;
  }

  const rl = readline.createInterface({ input: ctx.stdin, output: ctx.stdout });
  try {
    ctx.stdout.write(`\n== ${copy.title} ==\n\n${copy.selectProvider}\n`);
    PROVIDER_PRESETS.forEach((preset, index) => {
      ctx.stdout.write(`  [${index + 1}] ${preset.name}\n`);
    });

    const preset = await askPreset(rl, copy);
    ctx.stdout.write(`\n${copy.selected(preset.name)}\n`);

    const baseUrl = parseBaseUrl(
      (await rl.question(copy.baseUrlPrompt(preset.defaultBaseUrl))).trim() ||
        preset.defaultBaseUrl,
    );
    const apiKeyPrompt = preset.defaultApiKey
      ? copy.apiKeyPromptWithDefault(preset.defaultApiKey)
      : copy.apiKeyPromptOptional;
    const apiKey =
      (await rl.question(apiKeyPrompt)).trim() || preset.defaultApiKey || NO_API_KEY_PLACEHOLDER;

    if (preset.suggestedModels.length > 0) {
      ctx.stdout.write(`\n${copy.suggestedModels(preset.id)}\n`);
      preset.suggestedModels.forEach((model, index) => {
        ctx.stdout.write(`  - ${model}${index === 0 ? copy.recommendedSuffix : ""}\n`);
      });
    }
    const model =
      (await rl.question(copy.modelPrompt(preset.defaultModel))).trim() || preset.defaultModel;

    const userConfigPath = overrides.userConfigPath ?? getDefaultConfigPath();
    ctx.stdout.write(`\n${copy.saveWhere}\n${copy.saveProjectOption}\n`);
    ctx.stdout.write(`${copy.saveGlobalOption(userConfigPath)}\n`);
    const saveTarget = (await rl.question(copy.savePrompt)).trim();

    if (saveTarget === SAVE_TARGET_GLOBAL) {
      await writeUserProviderConfig(userConfigPath, {
        providerId: preset.id,
        name: preset.name,
        baseUrl,
        apiKey,
        model,
      });
      ctx.stdout.write(`\n${copy.saved(userConfigPath)}\n`);
    } else {
      const projectDir = (deps.cwd ?? process.cwd)();
      const envFilePath = join(projectDir, ENV_FILE_NAME);
      await upsertEnvEntries(envFilePath, {
        [ENV_KEY_BASE_URL]: baseUrl,
        [ENV_KEY_API_KEY]: apiKey,
        [ENV_KEY_MODEL]: model,
      });
      ctx.stdout.write(`\n${copy.saved(envFilePath)}\n`);
      if (await ensureEnvGitignored(projectDir)) {
        ctx.stdout.write(`${copy.gitignoreAdded}\n`);
      }
    }
    ctx.stdout.write(`${copy.seedPrecedenceNote}\n`);

    ctx.stdout.write(`\n${copy.testing(baseUrl)} `);
    ctx.stdout.write(`${probeMessage(copy, await probeModelsEndpoint(baseUrl, apiKey))}\n`);

    ctx.stdout.write(`\n${copy.done}\n\n`);
    return 0;
  } catch (error) {
    ctx.stderr.write(`\n${copy.aborted(describeWizardError(copy, error))}\n`);
    return 1;
  } finally {
    rl.close();
  }
}

async function askPreset(rl: readline.Interface, copy: InitCopy): Promise<ProviderPreset> {
  const answer = (await rl.question(`\n${copy.choicePrompt}`)).trim();
  const index = Number.parseInt(answer, 10) - 1;
  return PROVIDER_PRESETS[index] ?? PROVIDER_PRESETS[0]!;
}

function parseBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidBaseUrlError(value);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new InvalidBaseUrlError(value);
  return value;
}

/** 探测只用于提示，任何失败都归一成状态，不影响已保存的配置。 */
async function probeModelsEndpoint(baseUrl: string, apiKey: string): Promise<ProbeResult> {
  const modelsUrl = new URL("models", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  try {
    const response = await fetch(modelsUrl, {
      headers: apiKey === NO_API_KEY_PLACEHOLDER ? {} : { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const reachable =
      response.ok || response.status === HTTP_UNAUTHORIZED || response.status === HTTP_FORBIDDEN;
    return reachable ? "connected" : "no-models-endpoint";
  } catch {
    return "unreachable";
  }
}

function probeMessage(copy: InitCopy, result: ProbeResult): string {
  switch (result) {
    case "connected":
      return copy.connected;
    case "no-models-endpoint":
      return copy.noModelsEndpoint;
    case "unreachable":
      return copy.unreachable;
  }
}

function describeWizardError(copy: InitCopy, error: unknown): string {
  if (error instanceof InvalidBaseUrlError) return copy.invalidBaseUrl(error.value);
  if (error instanceof InvalidEnvValueError) return copy.invalidEnvValue(error.envName);
  if (error instanceof InvalidExistingConfigError) return copy.invalidConfigFile(error.path);
  return error instanceof Error ? error.message : String(error);
}
