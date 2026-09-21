# FDCode Project Context & Architectural Map

## 1. Overview & Transformation Goal
- **Project Name**: FDCode (Forked & adapted from ZCode v3.14.0)
- **Goal**: Rebrand and adapt into an independent, local-first AI Coding Workspace with BYOK (Bring-Your-Own-Key) support for OpenAI-compatible APIs across Desktop, Web, and Terminal CLI.
- **License**: Apache 2.0 (with attribution preserved in NOTICE.md)

## 2. Monorepo Architecture Map
- `packages/desktop`: Electron app (Main, Preload, Renderer, Host, Schedulers).
- `packages/web`: React 18 + Vite Web Client for browser-based / remote sessions.
- `packages/server`: HTTP & WebSocket server (port 3030 default) and `stdio` IPC adapter for Desktop.
- `packages/ui`: Shared React components, Zustand store, and Design System tokens (`text-ui-*`).
- `packages/services`: Business logic (Session, Git, FileWatcher, Plugins, Skills, Credentials, Telemetry).
- `packages/provider`: LLM Provider resolution, model configurations, and API interfaces.
- `packages/provider-node`: Node.js specific provider utilities.
- `apps/zcode-cli`: Agent runtime harness (`zcode` CLI / TUI), tool execution, dynamic workflows.

## 3. Storage & Configuration Cheat Sheet
- Local data base dir: controlled by `ZCODE_DATA_BASE_DIR` (or future `FDCODE_DATA_BASE_DIR`), defaults to `~/.zcode` (or `~/.fdcode`).
- Server workspace path: `ZCODE_SERVER_WORKSPACE` (default current working directory).
- Built-in provider config: `scripts/builtin-provider-config.mjs`.

## 4. Agent Persona & Custom Rules Discovery
- Agent Identity: `FDCode` interactive coding agent (`apps/zcode-cli/packages/core/src/context/sections/cli-prefix.ts` & `identity.ts`).
- Guiding Principles: Minimal Code First (YAGNI, standard library first), Context Grounding (no guessing), Outcome-First communication, and Clean Code comment density.
- Rule File Resolution: Automatically loads `FDCODE.md` (priority 1) or `AGENTS.md` (priority 2) in workspace root and user home (`~/.fdcode/FDCODE.md`, `~/.zcode/AGENTS.md`).

## 5. Key Gotchas & Platform Workarounds
- **Node.js**: Requires Node.js 24.x (v24.18.1 installed) and pnpm 10+.
- **Windows File Locks**: `bundle-require` unlinking `.mjs` temp files can hit `EBUSY` on Windows due to module loader locks. Handled via error catching.
- **Native Addons**: `ssh2` and `cpu-features` have pure JS fallbacks if Visual C++ build tools are not installed.
