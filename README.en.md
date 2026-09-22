# FDCode

<div align="center">
  <img src="public/logo/icons/128x128.png" alt="FDCode Logo" width="96" height="96" />
  <h3>Local-First, Privacy-Centric AI Coding Workspace with Built-in RTK</h3>
  <p>
    <a href="README.md">ภาษาไทย</a> | English
  </p>
  <p>
    <img src="https://img.shields.io/badge/License-Apache--2.0-blue.svg" alt="License" />
    <img src="https://img.shields.io/badge/Node.js-24.x-brightgreen.svg" alt="Node.js" />
    <img src="https://img.shields.io/badge/pnpm-10.x-orange.svg" alt="pnpm" />
    <img src="https://img.shields.io/badge/RTK-Inside-purple.svg" alt="RTK Inside" />
    <img src="https://img.shields.io/badge/Local--First-Ollama%20%7C%20LM%20Studio-success.svg" alt="Local First" />
  </p>
</div>

---

**FDCode** is a local-first, privacy-centric AI coding workspace combining Electron Desktop, Web Client (Browser/Remote), and a full-screen Terminal TUI/CLI. Engineered for 100% data sovereignty (BYOK) with native **RTK (Rust Token Killer)** integration, reducing terminal output token consumption by 60–90%.

```
███████╗██████╗   ██████╗ ██████╗ ██████╗ ███████╗
██╔════╝██╔══██╗ ██╔════╝██╔═══██╗██╔══██╗██╔════╝
█████╗  ██║  ██║ ██║     ██║   ██║██║  ██║█████╗
██╔══╝  ██║  ██║ ██║     ██║   ██║██║  ██║██╔══╝
██║     ██████╔╝ ╚██████╗╚██████╔╝██████╔╝███████╗
╚═╝     ╚═════╝   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
```

---

## Key Highlights

- **Local-First & 100% Privacy**: Out-of-the-box presets for Ollama (`localhost:11434`) and LM Studio (`localhost:1234`). Your source code stays on your machine.
- **Built-in RTK (Rust Token Killer)**: Automatically intercepts terminal commands (`git status`, tests, linters) before transmitting to LLMs, slashing output tokens by 60–90% without manual typing.
- **Strict Agent Mindset**: Enforces 4 foundational engineering rules (`NO MAGIC`, `DOUBLE-CHECK`, `MINIMAL CODE FIRST`, `ITERATIVE EXECUTION`) preventing speculative bugs, debris, and phantom code.
- **Omni-Surface Interfaces**: Seamless workflow across Electron Desktop, Browser/Remote Web, and Terminal TUI (`fdcode`).
- **Interactive Setup Wizard**: Run `fdcode init` or `fdcode config` to configure models, ping endpoints, and store keys locally (`.env`) or globally (`~/.fdcode/cli/config.json`) in seconds.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Execution Surfaces (3 Interfaces)](#execution-surfaces-3-interfaces)
- [Model Configuration (Provider & BYOK)](#model-configuration-provider--byok)
- [Context Filtering with .fdcodeignore](#context-filtering-with-fdcodeignore)
- [Architecture Overview](#architecture-overview)
- [Developer Commands](#developer-commands)
- [License & Attributions](#license--attributions)

---

## Quick Start

### Prerequisites

- **Node.js**: `24.x` (see [mise.toml](mise.toml))
- **pnpm**: `10.x`
- **Git**

### 1. Install Dependencies & Bootstrap

```bash
pnpm install
pnpm bootstrap
```

### 2. Run Interactive Setup Wizard

```bash
# Configure Ollama, LM Studio, DeepSeek, OpenAI, or Custom endpoints
node apps/zcode-cli/packages/cli/dist/zcode.cjs init
```

### 3. Launch FDCode

```bash
# Launch Terminal TUI
node apps/zcode-cli/packages/cli/dist/zcode.cjs

# Or launch Electron Desktop
pnpm dev:desktop
```

> **Tip**: Run `npm link` in the root workspace to access `fdcode` globally from any folder.

---

## Execution Surfaces (3 Interfaces)

| Interface               | Command                                    | Description                                                                        |
| :---------------------- | :----------------------------------------- | :--------------------------------------------------------------------------------- |
| **Terminal TUI / CLI**  | `fdcode` or `pnpm --filter @zcode/cli dev` | Fast, lightweight full-screen TUI directly in your shell                           |
| **Desktop App**         | `pnpm dev:desktop`                         | Full Electron application with multi-tab workspace management                      |
| **Web / Remote Client** | `pnpm dev:web`                             | Browser-based client (`http://localhost:5173`) for headless and remote VPS servers |

---

## Model Configuration (Provider & BYOK)

FDCode supports local LLMs and remote APIs adhering to the OpenAI-Compatible format:

### 1. Local LLMs (Recommended)

- **Ollama**: Start your local model (e.g. `ollama run qwen2.5-coder:32b` or `deepseek-r1:14b`), then select Ollama in `fdcode init` (Base URL: `http://localhost:11434/v1`).
- **LM Studio**: Load your model, start the local server, and select LM Studio in `fdcode init` (Base URL: `http://localhost:1234/v1`).

### 2. Remote APIs (BYOK)

Bring your own API key for DeepSeek, OpenAI, OpenRouter, or private gateways. Credentials are securely stored at:

- **Project level**: `.env` in the current project root.
- **Global level**: `~/.fdcode/cli/config.json` across all workspaces.

---

## Context Filtering with .fdcodeignore

FDCode inspects `.fdcodeignore` to exclude files from agent context (e.g. test artifacts, build caches, scratch logs):

- Standard `.gitignore` syntax.
- **Zero-migration fallback**: Automatically falls back to `.zcodeignore` if present in legacy workspaces.

---

## Architecture Overview

```text
FDCode/
├── apps/
│   └── zcode-cli/         # Agent CLI, Terminal TUI, Runtime & RTK Rewriter
├── packages/
│   ├── desktop/           # Electron Main, Preload & Renderer
│   ├── web/               # React 18 + Vite Web Client
│   ├── server/            # HTTP & WebSocket Server (port 3030)
│   ├── ui/                # Shared React UI Components & Zustand Store
│   ├── services/          # File, Git, Session & Ignore Service
│   ├── shared/            # Protocols, Types & Data Contracts
│   ├── provider/          # LLM Provider Interfaces & Resolution
│   └── provider-node/     # Node.js Provider Adapters
└── config/
    └── provider/          # Built-in Provider Templates (Ollama, LM Studio)
```

---

## Developer Commands

```bash
# Typecheck across the monorepo
pnpm typecheck

# Code quality and linters
pnpm lint

# Architecture boundary enforcement
pnpm architecture:check --changed

# Complete pre-push validation
pnpm verify:pre-push

# Build CLI executable
pnpm --filter @zcode/cli build
```

---

## License & Attributions

FDCode is forked and adapted from ZCode v3.14.0 under the **Apache License 2.0**. For original copyright notices and third-party dependencies, see [NOTICE.md](NOTICE.md) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
