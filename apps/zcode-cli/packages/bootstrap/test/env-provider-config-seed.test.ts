import assert from "node:assert/strict";
import test from "node:test";
import { readEnvProviderConfigSeed } from "../src/app/env-provider-config-seed.js";

test("returns no seed without OPENAI_API_KEY", () => {
  assert.equal(readEnvProviderConfigSeed({}), null);
  assert.equal(readEnvProviderConfigSeed({ OPENAI_API_KEY: "  " }), null);
  assert.equal(readEnvProviderConfigSeed({ FDCODE_API_KEY: "legacy-alias" }), null);
});

test("builds an openai-compatible seed from the OpenAI environment variables", () => {
  const seed = readEnvProviderConfigSeed({
    OPENAI_API_KEY: "sk-test",
    OPENAI_BASE_URL: "http://localhost:11434/v1",
    OPENAI_MODEL: "qwen2.5-coder:32b",
  });

  assert.deepEqual(seed?.defaultModelSelection, {
    providerId: "openai-compatible",
    modelId: "qwen2.5-coder:32b",
  });
});

test("falls back to the OpenAI defaults for a missing base URL and model", () => {
  const seed = readEnvProviderConfigSeed({ OPENAI_API_KEY: "sk-test" });

  assert.equal(seed?.defaultModelSelection?.modelId, "gpt-4o");
});
