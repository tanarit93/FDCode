import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import type { GlobalOptions, RunContext } from "@zcode/shared-types";
import type { RunDependencies } from "../src/cli-types.js";
import { runInitCommand } from "../src/init-command.js";

const OPTIONS: GlobalOptions = {
  force: false,
  json: false,
  locale: "en-US",
  noColor: true,
  verbose: false,
};

interface Harness {
  ctx: RunContext;
  stdout: () => string;
  stderr: () => string;
}

/** 每当向导写出不以换行结尾的提示，就喂入下一条答案。 */
function createHarness(answers: string[], options: { tty: boolean } = { tty: true }): Harness {
  const stdin = Object.assign(new PassThrough(), { isTTY: options.tty });
  let stdoutText = "";
  let stderrText = "";
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      const text = String(chunk);
      stdoutText += text;
      const answer = text.endsWith("\n") ? undefined : answers.shift();
      if (answer !== undefined) setImmediate(() => stdin.write(`${answer}\n`));
      callback();
    },
  });
  const stderr = new Writable({
    write(chunk, _encoding, callback) {
      stderrText += String(chunk);
      callback();
    },
  });
  return {
    ctx: { argv: [], stdin, stdout, stderr } as unknown as RunContext,
    stdout: () => stdoutText,
    stderr: () => stderrText,
  };
}

async function withTempDir(
  run: (dir: string, restoreFetch: () => void) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "fdcode-init-cmd-"));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  try {
    await run(dir, () => {
      globalThis.fetch = originalFetch;
    });
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
}

function depsFor(dir: string): RunDependencies {
  return { cwd: () => dir } as RunDependencies;
}

test("fails fast when stdin is not a TTY", async () => {
  const harness = createHarness([], { tty: false });

  const code = await runInitCommand(harness.ctx, OPTIONS, {} as RunDependencies);

  assert.equal(code, 1);
  assert.match(harness.stderr(), /interactive terminal/);
});

test("saves the chosen preset to the project .env", async () => {
  await withTempDir(async (dir) => {
    const harness = createHarness(["1", "", "", "", "1"]);

    const code = await runInitCommand(harness.ctx, OPTIONS, depsFor(dir));

    assert.equal(code, 0, harness.stderr());
    const env = await readFile(join(dir, ".env"), "utf8");
    assert.match(env, /OPENAI_BASE_URL="http:\/\/localhost:11434\/v1"/);
    assert.match(env, /OPENAI_API_KEY="ollama"/);
    assert.match(env, /OPENAI_MODEL="qwen2.5-coder:32b"/);
    assert.match(harness.stdout(), /Connected successfully/);
  });
});

test("saves a provider map to the user config file", async () => {
  await withTempDir(async (dir) => {
    const userConfigPath = join(dir, "user", "config.json");
    const harness = createHarness(["4", "", "sk-test", "gpt-4o-mini", "2"]);

    const code = await runInitCommand(harness.ctx, OPTIONS, depsFor(dir), { userConfigPath });

    assert.equal(code, 0, harness.stderr());
    const config = JSON.parse(await readFile(userConfigPath, "utf8"));
    assert.equal(config.provider.openai.options.apiKey, "sk-test");
    assert.equal(config.provider.openai.options.baseURL, "https://api.openai.com/v1");
    assert.equal(config.model.main, "openai/gpt-4o-mini");
    await assert.rejects(stat(join(dir, ".env")), { code: "ENOENT" });
  });
});

test("uses a placeholder key for local servers when the key is left blank", async () => {
  await withTempDir(async (dir) => {
    const harness = createHarness(["6", "", "", "", "1"]);

    const code = await runInitCommand(harness.ctx, OPTIONS, depsFor(dir));

    assert.equal(code, 0, harness.stderr());
    assert.match(await readFile(join(dir, ".env"), "utf8"), /OPENAI_API_KEY="none"/);
  });
});

test("rejects a non-http Base URL without writing anything", async () => {
  await withTempDir(async (dir) => {
    const harness = createHarness(["1", "ftp://example.com", "", "", "1"]);

    const code = await runInitCommand(harness.ctx, OPTIONS, depsFor(dir));

    assert.equal(code, 1);
    assert.match(harness.stderr(), /Invalid Base URL: ftp:\/\/example.com/);
    await assert.rejects(stat(join(dir, ".env")), { code: "ENOENT" });
  });
});

test("does not overwrite an invalid user config file", async () => {
  await withTempDir(async (dir) => {
    const userConfigPath = join(dir, "config.json");
    await writeFile(userConfigPath, "{ broken");
    const harness = createHarness(["1", "", "", "", "2"]);

    const code = await runInitCommand(harness.ctx, OPTIONS, depsFor(dir), { userConfigPath });

    assert.equal(code, 1);
    assert.match(harness.stderr(), /not valid JSON/);
    assert.equal(await readFile(userConfigPath, "utf8"), "{ broken");
  });
});

test("reports an unreachable endpoint without failing the setup", async () => {
  await withTempDir(async (dir, restoreFetch) => {
    restoreFetch();
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    const harness = createHarness(["1", "", "", "", "1"]);

    const code = await runInitCommand(harness.ctx, OPTIONS, depsFor(dir));

    assert.equal(code, 0, harness.stderr());
    assert.match(harness.stdout(), /Could not reach the endpoint/);
  });
});
