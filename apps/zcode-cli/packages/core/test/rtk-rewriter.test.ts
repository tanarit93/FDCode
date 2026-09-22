import assert from "node:assert/strict";
import test from "node:test";
import { isRuntimeReadOnlyBashCommand } from "../src/tool/handlers/bash-semantics.js";
import { stripSafeCommandWrappers } from "../src/tool/handlers/bash-readonly-policy-argv-io.js";
import {
  createRtkRewriter,
  resolveBashRtkPolicy,
  type RtkRunner,
} from "../src/tool/handlers/rtk-rewriter.js";

const ENABLED = { enabled: true };

function createRunner(handlers: {
  version?: () => Promise<{ stdout: string }>;
  check?: (command: string) => Promise<{ stdout: string }>;
}): { run: RtkRunner; calls: string[][] } {
  const calls: string[][] = [];
  const run: RtkRunner = async (args) => {
    calls.push([...args]);
    if (args[0] === "--version") return handlers.version?.() ?? { stdout: "rtk 0.48.0" };
    if (args[0] === "hook" && args[1] === "check") {
      if (!handlers.check) throw new Error("no rewrite");
      return handlers.check(args[2] ?? "");
    }
    throw new Error(`unexpected rtk call: ${args.join(" ")}`);
  };
  return { run, calls };
}

test("rewrites the command with the output of `rtk hook check`", async () => {
  const { run } = createRunner({ check: async (cmd) => ({ stdout: `rtk ${cmd}\n` }) });
  const rewriter = createRtkRewriter(run);

  assert.equal(await rewriter.rewrite("git status", ENABLED), "rtk git status");
});

test("keeps the original command when rtk has no rewrite", async () => {
  const { run } = createRunner({});
  const rewriter = createRtkRewriter(run);

  assert.equal(await rewriter.rewrite("echo hi", ENABLED), "echo hi");
});

test("keeps the original command when rtk is not installed", async () => {
  const { run, calls } = createRunner({
    version: async () => {
      throw new Error("ENOENT");
    },
    check: async (cmd) => ({ stdout: `rtk ${cmd}` }),
  });
  const rewriter = createRtkRewriter(run);

  assert.equal(await rewriter.rewrite("git status", ENABLED), "git status");
  assert.equal(await rewriter.rewrite("git diff", ENABLED), "git diff");
  assert.equal(calls.filter((args) => args[0] === "--version").length, 1);
});

test("rejects a binary that does not identify itself as rtk", async () => {
  const { run } = createRunner({
    version: async () => ({ stdout: "other-tool 1.0.0" }),
    check: async (cmd) => ({ stdout: `rtk ${cmd}` }),
  });

  assert.equal(await createRtkRewriter(run).rewrite("git status", ENABLED), "git status");
});

test("does not touch rtk when the policy is disabled", async () => {
  const { run, calls } = createRunner({ check: async (cmd) => ({ stdout: `rtk ${cmd}` }) });

  assert.equal(await createRtkRewriter(run).rewrite("git status", { enabled: false }), "git status");
  assert.deepEqual(calls, []);
});

test("skips commands that already start with rtk or are blank", async () => {
  const { run, calls } = createRunner({ check: async (cmd) => ({ stdout: `rtk ${cmd}` }) });
  const rewriter = createRtkRewriter(run);

  assert.equal(await rewriter.rewrite("rtk git status", ENABLED), "rtk git status");
  assert.equal(await rewriter.rewrite("rtk.exe gain", ENABLED), "rtk.exe gain");
  assert.equal(await rewriter.rewrite("   ", ENABLED), "   ");
  assert.deepEqual(calls, []);
});

test("shares one availability probe between concurrent calls", async () => {
  const { run, calls } = createRunner({ check: async (cmd) => ({ stdout: `rtk ${cmd}` }) });
  const rewriter = createRtkRewriter(run);

  await Promise.all([rewriter.rewrite("git status", ENABLED), rewriter.rewrite("git diff", ENABLED)]);

  assert.equal(calls.filter((args) => args[0] === "--version").length, 1);
});

test("ZCODE_DISABLE_RTK disables the policy only for 1 or true", () => {
  assert.deepEqual(resolveBashRtkPolicy({}), { enabled: true });
  assert.deepEqual(resolveBashRtkPolicy({ ZCODE_DISABLE_RTK: "1" }), { enabled: false });
  assert.deepEqual(resolveBashRtkPolicy({ ZCODE_DISABLE_RTK: " TRUE " }), { enabled: false });
  assert.deepEqual(resolveBashRtkPolicy({ ZCODE_DISABLE_RTK: "0" }), { enabled: true });
  assert.deepEqual(resolveBashRtkPolicy({ RTK_DISABLE: "1" }), { enabled: true });
});

test("rtk inspection subcommands are read-only, but gain --reset is not", () => {
  assert.equal(isRuntimeReadOnlyBashCommand("rtk gain"), true);
  assert.equal(isRuntimeReadOnlyBashCommand("rtk gain --history"), true);
  assert.equal(isRuntimeReadOnlyBashCommand("rtk --version"), true);
  assert.equal(isRuntimeReadOnlyBashCommand("rtk gain --reset"), false);
  assert.equal(isRuntimeReadOnlyBashCommand("rtk gain --reset --yes"), false);
  assert.equal(isRuntimeReadOnlyBashCommand("rtk gain; rm -rf ."), false);
});

test("rtk-wrapped commands keep the read-only verdict of the wrapped command", () => {
  assert.equal(isRuntimeReadOnlyBashCommand("rtk git status"), true);
  assert.equal(isRuntimeReadOnlyBashCommand("rtk proxy git status"), true);
  assert.equal(isRuntimeReadOnlyBashCommand("rtk git push"), false);
  assert.equal(isRuntimeReadOnlyBashCommand("rtk proxy rm -rf ."), false);
});

test("rtk wrappers are judged by the wrapped command", () => {
  assert.deepEqual(stripSafeCommandWrappers(["rtk", "git", "status"]), ["git", "status"]);
  assert.deepEqual(stripSafeCommandWrappers(["rtk", "proxy", "git", "push"]), ["git", "push"]);
  assert.deepEqual(stripSafeCommandWrappers(["rtk", "gain"]), ["rtk", "gain"]);
});
