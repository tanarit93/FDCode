import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  InvalidEnvValueError,
  InvalidExistingConfigError,
  ensureEnvGitignored,
  upsertEnvEntries,
  writeUserProviderConfig,
} from "../src/init-config-writers.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "fdcode-init-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const ENTRIES = {
  OPENAI_BASE_URL: "http://localhost:11434/v1",
  OPENAI_API_KEY: "ollama",
  OPENAI_MODEL: "qwen2.5-coder:32b",
};

test("upsertEnvEntries is idempotent and keeps unrelated lines", async () => {
  await withTempDir(async (dir) => {
    const envPath = join(dir, ".env");
    await writeFile(envPath, "DATABASE_URL=postgres://x\n");

    await upsertEnvEntries(envPath, ENTRIES);
    await upsertEnvEntries(envPath, { ...ENTRIES, OPENAI_MODEL: "llama3.3" });

    const lines = (await readFile(envPath, "utf8")).trimEnd().split("\n");
    assert.equal(lines.filter((line) => line.startsWith("OPENAI_MODEL=")).length, 1);
    assert.ok(lines.includes('OPENAI_MODEL="llama3.3"'));
    assert.ok(lines.includes("DATABASE_URL=postgres://x"));
    assert.equal(lines.filter((line) => line === "# FDCode Model Configuration").length, 1);
  });
});

test("upsertEnvEntries collapses duplicate keys left by earlier runs", async () => {
  await withTempDir(async (dir) => {
    const envPath = join(dir, ".env");
    await writeFile(envPath, 'OPENAI_API_KEY="old1"\nKEEP=1\nOPENAI_API_KEY="old2"\n');

    await upsertEnvEntries(envPath, { OPENAI_API_KEY: "new" });

    assert.equal(await readFile(envPath, "utf8"), 'OPENAI_API_KEY="new"\nKEEP=1\n');
  });
});

test("upsertEnvEntries rejects values that cannot be stored safely", async () => {
  await withTempDir(async (dir) => {
    const envPath = join(dir, ".env");
    await assert.rejects(
      upsertEnvEntries(envPath, { OPENAI_API_KEY: 'sk-"; rm -rf /' }),
      InvalidEnvValueError,
    );
    await assert.rejects(upsertEnvEntries(envPath, { OPENAI_MODEL: "a\nb" }), InvalidEnvValueError);
    await assert.rejects(stat(envPath), { code: "ENOENT" });
  });
});

test("ensureEnvGitignored only edits .gitignore inside a git repository", async () => {
  await withTempDir(async (dir) => {
    assert.equal(await ensureEnvGitignored(dir), false);
    await assert.rejects(stat(join(dir, ".gitignore")), { code: "ENOENT" });

    await mkdir(join(dir, ".git"));
    await writeFile(join(dir, ".gitignore"), "node_modules");

    assert.equal(await ensureEnvGitignored(dir), true);
    assert.equal(await readFile(join(dir, ".gitignore"), "utf8"), "node_modules\n.env\n");
    assert.equal(await ensureEnvGitignored(dir), false);
  });
});

test("ensureEnvGitignored respects an existing .env rule", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".git"));
    await writeFile(join(dir, ".gitignore"), "/.env\n");

    assert.equal(await ensureEnvGitignored(dir), false);
  });
});

test("writeUserProviderConfig writes a provider map and keeps other providers", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "nested", "config.json");
    await mkdir(join(dir, "nested"));
    await writeFile(
      configPath,
      JSON.stringify({
        theme: "dark",
        provider: { other: { kind: "anthropic", options: { apiKey: "k" } } },
      }),
    );

    await writeUserProviderConfig(configPath, {
      providerId: "ollama",
      name: "Ollama",
      baseUrl: "http://localhost:11434/v1",
      apiKey: "ollama",
      model: "qwen2.5-coder:32b",
    });
    await writeUserProviderConfig(configPath, {
      providerId: "ollama",
      name: "Ollama",
      baseUrl: "http://localhost:11434/v1",
      apiKey: "ollama",
      model: "llama3.3",
    });

    const config = JSON.parse(await readFile(configPath, "utf8"));
    assert.equal(config.theme, "dark");
    assert.deepEqual(config.provider.other, { kind: "anthropic", options: { apiKey: "k" } });
    assert.equal(config.provider.ollama.kind, "openai-compatible");
    assert.equal(config.provider.ollama.options.baseURL, "http://localhost:11434/v1");
    assert.deepEqual(Object.keys(config.provider.ollama.models), [
      "qwen2.5-coder:32b",
      "llama3.3",
    ]);
    assert.equal(config.model.main, "ollama/llama3.3");
  });
});

test("writeUserProviderConfig creates the file with owner-only permissions", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX file modes are not enforced on Windows");
    return;
  }
  await withTempDir(async (dir) => {
    const configPath = join(dir, "config.json");
    await writeUserProviderConfig(configPath, {
      providerId: "custom",
      name: "Custom",
      baseUrl: "http://localhost:8000/v1",
      apiKey: "none",
      model: "m",
    });

    assert.equal((await stat(configPath)).mode & 0o777, 0o600);
  });
});

test("writeUserProviderConfig refuses to overwrite an invalid config file", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "config.json");
    await writeFile(configPath, "{ not json");

    await assert.rejects(
      writeUserProviderConfig(configPath, {
        providerId: "custom",
        name: "Custom",
        baseUrl: "http://localhost:8000/v1",
        apiKey: "none",
        model: "m",
      }),
      InvalidExistingConfigError,
    );
    assert.equal(await readFile(configPath, "utf8"), "{ not json");
  });
});
