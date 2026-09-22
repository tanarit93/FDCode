export interface ProviderPreset {
  id: string;
  name: string;
  defaultBaseUrl: string;
  defaultApiKey: string;
  defaultModel: string;
  suggestedModels: readonly string[];
}

/** 本地推理服务不校验 Key，但 Provider 配置要求非空值。 */
export const NO_API_KEY_PLACEHOLDER = "none";

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: "ollama",
    name: "Ollama (Local LLM - 100% Private)",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultApiKey: "ollama",
    defaultModel: "qwen2.5-coder:32b",
    suggestedModels: [
      "qwen2.5-coder:32b",
      "qwen2.5-coder:14b",
      "deepseek-r1:32b",
      "deepseek-coder-v2",
      "llama3.3",
    ],
  },
  {
    id: "lm-studio",
    name: "LM Studio (Local LLM - 100% Private)",
    defaultBaseUrl: "http://localhost:1234/v1",
    defaultApiKey: "lm-studio",
    defaultModel: "qwen2.5-coder-32b-instruct",
    suggestedModels: ["qwen2.5-coder-32b-instruct", "deepseek-r1-distill-qwen-32b", "local-model"],
  },
  {
    id: "deepseek",
    name: "DeepSeek API",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultApiKey: "",
    defaultModel: "deepseek-chat",
    suggestedModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "openai",
    name: "OpenAI Official API",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultApiKey: "",
    defaultModel: "gpt-4o",
    suggestedModels: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultApiKey: "",
    defaultModel: "anthropic/claude-3.5-sonnet",
    suggestedModels: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "deepseek/deepseek-r1"],
  },
  {
    id: "custom",
    name: "Custom OpenAI-Compatible Endpoint",
    defaultBaseUrl: "http://localhost:8000/v1",
    defaultApiKey: "",
    defaultModel: "default-model",
    suggestedModels: [],
  },
];
