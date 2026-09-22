// 运行：TSX_TSCONFIG_PATH=packages/ui/tsconfig.json node_modules/.bin/tsx --test packages/ui/test/loginApiKeyForm.helpers.test.ts（helpers 使用 `@/` 路径别名）
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLoginApiKeyInitialConfig,
  isHttpUrl,
  isLoginApiKeyRequired,
  resolveLoginApiKeyTemplateId,
} from "../src/login/LoginApiKeyForm.helpers.js";

test("only the OpenAI-compatible choice may omit the API key", () => {
  assert.equal(isLoginApiKeyRequired("openai-compatible"), false);
  assert.equal(isLoginApiKeyRequired("zai"), true);
  assert.equal(isLoginApiKeyRequired("bigmodel"), true);
});

test("an empty key for an OpenAI-compatible endpoint gets a placeholder", () => {
  const config = buildLoginApiKeyInitialConfig({
    choice: "openai-compatible",
    accessType: "api-key",
    apiKey: "",
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5-coder:32b",
  });

  assert.deepEqual(config, {
    access: { type: "api-key", apiKey: "none" },
    api: { type: "openai-chat-completions", baseUrl: "http://localhost:11434/v1" },
    personalModelIds: ["qwen2.5-coder:32b"],
    modelOrder: ["qwen2.5-coder:32b"],
  });
});

test("blank base URL and model fall back to the OpenAI defaults", () => {
  const config = buildLoginApiKeyInitialConfig({
    choice: "openai-compatible",
    accessType: "api-key",
    apiKey: "sk-test",
    baseUrl: "",
    model: "",
  });

  assert.deepEqual(config.api, {
    type: "openai-chat-completions",
    baseUrl: "https://api.openai.com/v1",
  });
  assert.deepEqual(config.personalModelIds, ["gpt-4o"]);
});

test("Z.ai and BigModel keep the template-only config", () => {
  assert.deepEqual(
    buildLoginApiKeyInitialConfig({
      choice: "zai",
      accessType: "api-key",
      apiKey: "k",
      baseUrl: "ignored",
      model: "ignored",
    }),
    { access: { type: "api-key", apiKey: "k" } },
  );
  assert.equal(resolveLoginApiKeyTemplateId("zai"), "zai-api");
  assert.equal(resolveLoginApiKeyTemplateId("bigmodel"), "bigmodel-api");
});

test("isHttpUrl accepts only http and https URLs", () => {
  assert.equal(isHttpUrl("http://localhost:8000/v1"), true);
  assert.equal(isHttpUrl("https://api.openai.com/v1"), true);
  assert.equal(isHttpUrl("ftp://example.com"), false);
  assert.equal(isHttpUrl("localhost:8000"), false);
  assert.equal(isHttpUrl("not a url"), false);
});
