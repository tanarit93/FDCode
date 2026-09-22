import {
  ApiKeyAccessConfig,
  ModelConfigRules,
  ProviderApiConfig,
  ProviderConfig,
  ProviderConfigMap,
  type ProviderConfigLayerUpdate,
} from "@zcode/provider";

const ENV_PROVIDER_ID = "openai-compatible";
const ENV_PROVIDER_NAME = "OpenAI Compatible (BYOK)";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL_ID = "gpt-4o";

/**
 * 用 OpenAI 通用环境变量生成一个 Provider 种子。优先级最低：调用方只在
 * Personal Provider 文件和旧 CLI 配置文件都不存在时才使用它（规格见
 * docs/specs/fdcode-init-wizard.md）。没有 `OPENAI_API_KEY` 时不生成种子。
 */
export function readEnvProviderConfigSeed(
  env: Readonly<Record<string, string | undefined>>,
): ProviderConfigLayerUpdate | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const modelId = env.OPENAI_MODEL?.trim() || DEFAULT_MODEL_ID;

  const providers = ProviderConfigMap.empty().setRule({
    providerId: ENV_PROVIDER_ID,
    templateId: ENV_PROVIDER_ID,
    providerName: ENV_PROVIDER_NAME,
    config: new ProviderConfig({
      group: "standard-personal",
      access: new ApiKeyAccessConfig({ apiKey }),
      api: new ProviderApiConfig({ type: "openai-chat-completions", baseUrl }),
      personalModelIds: [modelId],
      modelOrder: [modelId],
    }),
  });

  return Object.freeze({
    providers,
    models: ModelConfigRules.empty(),
    defaultModelSelection: Object.freeze({ providerId: ENV_PROVIDER_ID, modelId }),
  });
}
