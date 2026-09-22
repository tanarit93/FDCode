import {
  BUILTIN_PROVIDER_TEMPLATE_IDS,
  type AppSettings,
  type ProviderFamilyDomain,
} from "@zcode/shared";
import type { ModelSelectionView } from "@zcode/services";
import { encodeCustomModelValue } from "@/lib/zcodeCustomModelValue.js";

export type ApiKeyProviderChoice = "openai-compatible" | "zai" | "bigmodel";

export const OPENAI_COMPATIBLE_DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const OPENAI_COMPATIBLE_DEFAULT_MODEL = "gpt-4o";
/** 本地推理服务不校验 Key，但 Provider 凭据不能为空；与 CLI 向导使用同一占位值。 */
const NO_API_KEY_PLACEHOLDER = "none";

const TEMPLATE_ID_BY_CHOICE = {
  "openai-compatible": BUILTIN_PROVIDER_TEMPLATE_IDS.openaiCompatible,
  zai: BUILTIN_PROVIDER_TEMPLATE_IDS.zai,
  bigmodel: BUILTIN_PROVIDER_TEMPLATE_IDS.bigmodel,
} as const satisfies Record<ApiKeyProviderChoice, string>;

export function resolveLoginApiKeyDefaultProvider(): ApiKeyProviderChoice {
  return "openai-compatible";
}

export function resolveLoginApiKeyTemplateId(
  choice: ApiKeyProviderChoice,
): (typeof TEMPLATE_ID_BY_CHOICE)[ApiKeyProviderChoice] {
  return TEMPLATE_ID_BY_CHOICE[choice];
}

/** 自定义 OpenAI 兼容端点可能是本地服务，允许不填 API Key。 */
export function isLoginApiKeyRequired(choice: ApiKeyProviderChoice): boolean {
  return choice !== "openai-compatible";
}

export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function buildLoginApiKeyInitialConfig(input: {
  choice: ApiKeyProviderChoice;
  accessType: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}): Record<string, unknown> {
  const access = {
    type: input.accessType,
    apiKey:
      input.apiKey || (isLoginApiKeyRequired(input.choice) ? undefined : NO_API_KEY_PLACEHOLDER),
  };
  if (input.choice !== "openai-compatible") return { access };

  const model = input.model || OPENAI_COMPATIBLE_DEFAULT_MODEL;
  return {
    access,
    api: {
      type: "openai-chat-completions",
      baseUrl: input.baseUrl || OPENAI_COMPATIBLE_DEFAULT_BASE_URL,
    },
    personalModelIds: [model],
    modelOrder: [model],
  };
}

export function resolveLoginApiKeyProviderLabel(choice: ApiKeyProviderChoice): string {
  if (choice === "openai-compatible") return "OpenAI Compatible (BYOK)";
  return choice === "zai" ? "Z.ai" : "BigModel";
}

function resolveLoginApiKeyProviderFamilyDomain(
  choice: ApiKeyProviderChoice,
): ProviderFamilyDomain {
  // BYOK 没有 provider family 运行域，落到国际默认域，只为写入“已确认”标记。
  return choice === "openai-compatible" ? "zai" : choice;
}

export function buildLoginApiKeySkipSettings(
  choice: ApiKeyProviderChoice,
  now: number,
): Pick<
  AppSettings,
  "providerFamilyDomain" | "providerFamilyDomainUpdatedAt" | "providerFamilyDomainMigrated"
> {
  return {
    providerFamilyDomain: resolveLoginApiKeyProviderFamilyDomain(choice),
    providerFamilyDomainUpdatedAt: now,
    providerFamilyDomainMigrated: true,
  };
}

export function shouldShowLoginApiKeyLink(
  apiKeyValue: string,
  apiKeyUrl: string | undefined,
): boolean {
  return Boolean(apiKeyUrl) && apiKeyValue.trim().length === 0;
}

export function buildLoginApiKeyDefaultModelPreferenceFromSelection(
  view: ModelSelectionView,
  providerId: string,
): string | null {
  const firstModel = view.providers.find((provider) => provider.providerId === providerId)
    ?.models[0]?.modelId;
  return firstModel ? encodeCustomModelValue(providerId, firstModel) : null;
}
