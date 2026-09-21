// ============================================================
// FDCode Setup & Configuration Wizard
// Interactive CLI configuration for Local LLMs & BYOK providers
// ============================================================

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { RunContext } from "@zcode/shared-types";
import type { RunDependencies } from "./cli-types.js";

interface ProviderPreset {
  id: string;
  name: string;
  defaultBaseUrl: string;
  defaultApiKey: string;
  defaultModel: string;
  suggestedModels: string[];
}

const PRESETS: Record<string, ProviderPreset> = {
  "1": {
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
  "2": {
    id: "lm-studio",
    name: "LM Studio (Local LLM - 100% Private)",
    defaultBaseUrl: "http://localhost:1234/v1",
    defaultApiKey: "lm-studio",
    defaultModel: "qwen2.5-coder-32b-instruct",
    suggestedModels: [
      "qwen2.5-coder-32b-instruct",
      "deepseek-r1-distill-qwen-32b",
      "local-model",
    ],
  },
  "3": {
    id: "deepseek",
    name: "DeepSeek API",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultApiKey: "",
    defaultModel: "deepseek-chat",
    suggestedModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  "4": {
    id: "openai",
    name: "OpenAI Official API",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultApiKey: "",
    defaultModel: "gpt-4o",
    suggestedModels: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  },
  "5": {
    id: "openrouter",
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultApiKey: "",
    defaultModel: "anthropic/claude-3.5-sonnet",
    suggestedModels: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
      "deepseek/deepseek-r1",
    ],
  },
  "6": {
    id: "custom",
    name: "Custom OpenAI-Compatible Endpoint",
    defaultBaseUrl: "http://localhost:8000/v1",
    defaultApiKey: "",
    defaultModel: "default-model",
    suggestedModels: [],
  },
};

export async function runInitCommand(
  ctx: RunContext,
  deps: RunDependencies,
): Promise<number> {
  const rl = readline.createInterface({ input, output });

  try {
    ctx.stdout.write("\n╔════════════════════════════════════════════════════╗\n");
    ctx.stdout.write("║            FDCode Setup & Config Wizard            ║\n");
    ctx.stdout.write("╚════════════════════════════════════════════════════╝\n\n");

    ctx.stdout.write("Select your AI model provider:\n");
    for (const [key, preset] of Object.entries(PRESETS)) {
      ctx.stdout.write(`  [${key}] ${preset.name}\n`);
    }

    const choiceRaw = (await rl.question("\nEnter choice (1-6) [default: 1]: ")).trim();
    const choice = choiceRaw || "1";
    const selectedPreset = PRESETS[choice] || PRESETS["1"]!;

    ctx.stdout.write(`\nSelected: ${selectedPreset.name}\n`);

    // 1. Base URL
    const baseUrlAnswer = (
      await rl.question(`Base URL [${selectedPreset.defaultBaseUrl}]: `)
    ).trim();
    const baseUrl = baseUrlAnswer || selectedPreset.defaultBaseUrl;

    // 2. API Key
    const apiKeyPrompt = selectedPreset.defaultApiKey
      ? `API Key [default: ${selectedPreset.defaultApiKey}]: `
      : "API Key (leave blank if not needed): ";
    const apiKeyAnswer = (await rl.question(apiKeyPrompt)).trim();
    const apiKey = apiKeyAnswer || selectedPreset.defaultApiKey;

    // 3. Model
    if (selectedPreset.suggestedModels.length > 0) {
      ctx.stdout.write(`\nSuggested models for ${selectedPreset.id}:\n`);
      selectedPreset.suggestedModels.forEach((m, idx) => {
        ctx.stdout.write(`  - ${m}${idx === 0 ? " (recommended)" : ""}\n`);
      });
    }
    const modelAnswer = (
      await rl.question(`Model name [${selectedPreset.defaultModel}]: `)
    ).trim();
    const model = modelAnswer || selectedPreset.defaultModel;

    // 4. Save Location
    ctx.stdout.write("\nWhere would you like to save this configuration?\n");
    ctx.stdout.write("  [1] Current Project (.env file in workspace)\n");
    ctx.stdout.write("  [2] Global User Config (~/.fdcode/cli/config.json)\n");
    const saveChoiceRaw = (await rl.question("Choose (1 or 2) [default: 1]: ")).trim();
    const saveChoice = saveChoiceRaw || "1";

    const workingDirectory = (deps.cwd ?? process.cwd)();

    if (saveChoice === "2") {
      // Save globally
      const globalDir = join(homedir(), ".fdcode", "cli");
      mkdirSync(globalDir, { recursive: true });
      const configFilePath = join(globalDir, "config.json");

      let currentConfig: Record<string, unknown> = {};
      if (existsSync(configFilePath)) {
        try {
          currentConfig = JSON.parse(readFileSync(configFilePath, "utf8"));
        } catch {
          currentConfig = {};
        }
      }

      currentConfig.provider = {
        kind: "openai-compatible",
        name: selectedPreset.name,
        options: {
          baseURL: baseUrl,
          apiKey: apiKey || "none",
        },
        models: {
          [model]: {
            id: model,
            name: model,
          },
        },
      };
      currentConfig.model = {
        main: {
          provider: "openai-compatible",
          model,
        },
      };

      writeFileSync(configFilePath, `${JSON.stringify(currentConfig, null, 2)}\n`, "utf8");
      ctx.stdout.write(`\nSaved configuration to: ${configFilePath}\n`);
    } else {
      // Save to project .env
      const envFilePath = join(workingDirectory, ".env");
      const envLines = [
        "",
        "# FDCode Model Configuration",
        `OPENAI_BASE_URL="${baseUrl}"`,
        `OPENAI_API_KEY="${apiKey || "none"}"`,
        `OPENAI_MODEL="${model}"`,
      ].join("\n");

      appendFileSync(envFilePath, `${envLines}\n`, "utf8");
      ctx.stdout.write(`\nSaved configuration to: ${envFilePath}\n`);
    }

    // 5. Connectivity Verification Ping
    ctx.stdout.write(`\nTesting connection to ${baseUrl}... `);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const testUrl = baseUrl.endsWith("/v1")
        ? `${baseUrl}/models`
        : baseUrl.endsWith("/")
          ? `${baseUrl}models`
          : `${baseUrl}/models`;

      const response = await fetch(testUrl, {
        method: "GET",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (response && (response.ok || response.status === 401 || response.status === 403)) {
        ctx.stdout.write("Connected successfully! (Server responded)\n");
      } else {
        ctx.stdout.write("Notice: Server did not respond to /models (it may still work during chat).\n");
      }
    } catch {
      ctx.stdout.write("Notice: Could not reach endpoint right now (ensure server is running).\n");
    }

    ctx.stdout.write("\nSetup complete! You can now run:\n");
    ctx.stdout.write("  fdcode\n\n");

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.stderr.write(`\nSetup aborted: ${message}\n`);
    return 1;
  } finally {
    rl.close();
  }
}
