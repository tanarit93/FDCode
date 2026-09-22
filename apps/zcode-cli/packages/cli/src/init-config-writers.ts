import { appendFile, chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const ENV_KEY_BASE_URL = "OPENAI_BASE_URL";
export const ENV_KEY_API_KEY = "OPENAI_API_KEY";
export const ENV_KEY_MODEL = "OPENAI_MODEL";

const ENV_FILE_NAME = ".env";
const GITIGNORE_FILE_NAME = ".gitignore";
const ENV_HEADER_COMMENT = "# FDCode Model Configuration";
const ENV_LINE_PATTERN = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;
const UNSAFE_ENV_VALUE_PATTERN = /["\r\n]/;
const GITIGNORE_ENV_PATTERNS = new Set([".env", "/.env", ".env*"]);
const PRIVATE_FILE_MODE = 0o600;

export class InvalidExistingConfigError extends Error {
  readonly path: string;

  constructor(path: string, options: { cause: unknown }) {
    super(`Existing config file is not valid JSON: ${path}`, options);
    this.name = "InvalidExistingConfigError";
    this.path = path;
  }
}

export class InvalidEnvValueError extends Error {
  readonly envName: string;

  constructor(envName: string) {
    super(`Value for ${envName} cannot be stored in a .env file`);
    this.name = "InvalidEnvValueError";
    this.envName = envName;
  }
}

export interface UserProviderConfigInput {
  providerId: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * 只更新 `entries` 里的键：已有则原地替换（并去掉重复行），缺失才追加，
 * 其余行原样保留，重复运行向导不会让 `.env` 越写越长。
 */
export async function upsertEnvEntries(
  envFilePath: string,
  entries: Readonly<Record<string, string>>,
): Promise<void> {
  for (const [name, value] of Object.entries(entries)) {
    // dotenv 的双引号值不会反转义 `\"`，含引号或换行的值只能拒绝，不能靠转义写入。
    if (UNSAFE_ENV_VALUE_PATTERN.test(value)) throw new InvalidEnvValueError(name);
  }

  const existing = (await readTextIfExists(envFilePath)) ?? "";
  const lines = existing === "" ? [] : existing.replace(/\r?\n$/, "").split(/\r?\n/);
  const written = new Set<string>();

  const updated = lines.flatMap((line) => {
    const name = ENV_LINE_PATTERN.exec(line)?.[1];
    if (name === undefined || !Object.hasOwn(entries, name)) return [line];
    if (written.has(name)) return [];
    written.add(name);
    return [`${name}="${entries[name]}"`];
  });

  const missing = Object.entries(entries).filter(([name]) => !written.has(name));
  if (missing.length > 0) {
    updated.push(...(updated.length > 0 ? [""] : []), ENV_HEADER_COMMENT);
    updated.push(...missing.map(([name, value]) => `${name}="${value}"`));
  }

  await writeFile(envFilePath, `${updated.join("\n")}\n`, { mode: PRIVATE_FILE_MODE });
  await chmod(envFilePath, PRIVATE_FILE_MODE);
}

/** 仅在项目是 Git 仓库且尚未忽略 `.env` 时追加规则，返回是否修改了 `.gitignore`。 */
export async function ensureEnvGitignored(projectDir: string): Promise<boolean> {
  if (!(await pathExists(join(projectDir, ".git")))) return false;

  const gitignorePath = join(projectDir, GITIGNORE_FILE_NAME);
  const current = (await readTextIfExists(gitignorePath)) ?? "";
  const alreadyIgnored = current.split(/\r?\n/).some((line) => GITIGNORE_ENV_PATTERNS.has(line.trim()));
  if (alreadyIgnored) return false;

  const separator = current === "" || current.endsWith("\n") ? "" : "\n";
  await appendFile(gitignorePath, `${separator}${ENV_FILE_NAME}\n`);
  return true;
}

/**
 * 按旧 CLI 配置格式写入用户级 Provider：`provider` 是以 providerId 为键的 map，
 * `model.main` 引用其中一个键。文件里已有的其他 Provider 与字段会保留；
 * 已有文件不是合法 JSON 时抛错而不是覆盖。
 */
export async function writeUserProviderConfig(
  configFilePath: string,
  input: UserProviderConfigInput,
): Promise<void> {
  const current = await readJsonObjectIfExists(configFilePath);
  const providers = isRecord(current.provider) ? current.provider : {};
  const existingProvider = providers[input.providerId];
  const previous = isRecord(existingProvider) ? existingProvider : {};
  const previousModels = isRecord(previous.models) ? previous.models : {};

  const next = {
    ...current,
    provider: {
      ...providers,
      [input.providerId]: {
        ...previous,
        kind: "openai-compatible",
        name: input.name,
        options: { baseURL: input.baseUrl, apiKey: input.apiKey },
        models: { ...previousModels, [input.model]: { id: input.model, name: input.model } },
      },
    },
    model: {
      ...(isRecord(current.model) ? current.model : {}),
      // 旧格式要求 "providerId/modelId" 字符串（按第一个 "/" 切分），对象形式会被 schema 拒绝。
      main: `${input.providerId}/${input.model}`,
    },
  };

  await mkdir(dirname(configFilePath), { recursive: true });
  const tempPath = `${configFilePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, { mode: PRIVATE_FILE_MODE });
  await rename(tempPath, configFilePath);
  await chmod(configFilePath, PRIVATE_FILE_MODE);
}

async function readJsonObjectIfExists(filePath: string): Promise<Record<string, unknown>> {
  const text = await readTextIfExists(filePath);
  if (text === null) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed)) return parsed;
    throw new Error("Config root must be a JSON object");
  } catch (cause) {
    throw new InvalidExistingConfigError(filePath, { cause });
  }
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isFileNotFound(error)) return null;
    throw error;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isFileNotFound(error)) return false;
    throw error;
  }
}

function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
