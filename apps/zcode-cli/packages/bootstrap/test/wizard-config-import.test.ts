import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readLegacyCliPersonalProviderConfig } from "../src/app/legacy-cli-personal-provider-config-importer.js";

/** 与 `fdcode init` 写出的用户级配置同形（见 cli/test/init-config-writers.test.ts）。 */
const WIZARD_CONFIG = {
  provider: {
    ollama: {
      kind: "openai-compatible",
      name: "Ollama (Local LLM - 100% Private)",
      options: { baseURL: "http://localhost:11434/v1", apiKey: "ollama" },
      models: { "qwen2.5-coder:32b": { id: "qwen2.5-coder:32b", name: "qwen2.5-coder:32b" } },
    },
  },
  model: { main: "ollama/qwen2.5-coder:32b" },
};

async function withConfigFile(
  content: unknown,
  run: (filePath: string) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "fdcode-wizard-import-"));
  try {
    const filePath = join(dir, "config.json");
    await writeFile(filePath, JSON.stringify(content));
    await run(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("the importer accepts the config written by the init wizard", async () => {
  await withConfigFile(WIZARD_CONFIG, async (filePath) => {
    const update = await readLegacyCliPersonalProviderConfig({ filePath, env: {} });

    assert.deepEqual(update?.defaultModelSelection, {
      providerId: "ollama",
      modelId: "qwen2.5-coder:32b",
    });
  });
});

test("the importer rejects the object form of model.main", async () => {
  const objectForm = { ...WIZARD_CONFIG, model: { main: { provider: "ollama", model: "m" } } };
  await withConfigFile(objectForm, async (filePath) => {
    await assert.rejects(readLegacyCliPersonalProviderConfig({ filePath, env: {} }));
  });
});

test("a missing config file falls back to the OPENAI_* environment seed", async () => {
  const update = await readLegacyCliPersonalProviderConfig({
    filePath: join(tmpdir(), "fdcode-does-not-exist", "config.json"),
    env: { OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-4o-mini" },
  });

  assert.equal(update?.defaultModelSelection?.modelId, "gpt-4o-mini");
});

test("an existing config file takes precedence over the environment seed", async () => {
  await withConfigFile(WIZARD_CONFIG, async (filePath) => {
    const update = await readLegacyCliPersonalProviderConfig({
      filePath,
      env: { OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-4o-mini" },
    });

    assert.equal(update?.defaultModelSelection?.providerId, "ollama");
  });
});
