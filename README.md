# FDCode

<div align="center">
  <img src="public/logo/icons/128x128.png" alt="FDCode Logo" width="96" height="96" />
  <h3>Local-First, Privacy-Centric AI Coding Workspace with Built-in RTK</h3>
  <p>
    ภาษาไทย | <a href="README.en.md">English</a>
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

**FDCode** คือ AI Coding Workspace แบบ Local-First ที่รวม Electron Desktop, Web Client (Browser/Remote) และ Terminal TUI/CLI เข้าด้วยกัน ออกแบบให้ควบคุมข้อมูลและโมเดลได้ 100% (BYOK) พร้อมติดตั้ง **RTK (Rust Token Killer)** ในตัว ช่วยลด Token ของ Terminal Output ได้ถึง 60–90%

```
███████╗██████╗   ██████╗ ██████╗ ██████╗ ███████╗
██╔════╝██╔══██╗ ██╔════╝██╔═══██╗██╔══██╗██╔════╝
█████╗  ██║  ██║ ██║     ██║   ██║██║  ██║█████╗  
██╔══╝  ██║  ██║ ██║     ██║   ██║██║  ██║██╔══╝  
██║     ██████╔╝ ╚██████╗╚██████╔╝██████╔╝███████╗
╚═╝     ╚═════╝   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
```

---

## จุดเด่นสำคัญ

- **Local-First & 100% Privacy**: มี Preset พร้อมใช้งานทันทีสำหรับ Ollama (`localhost:11434`) และ LM Studio (`localhost:1234`) ข้อมูลซอร์สโค้ดไม่หลุดออกภายนอก
- **Built-in RTK (Rust Token Killer)**: สกัดกั้นคำสั่ง Shell (`git status`, `test`, `build`) ก่อนส่งให้ LLM อัตโนมัติ ประหยัด Token 60–90% โดยไม่ต้องพิมพ์ `rtk` นำหน้าเอง
- **Core Agent Mindset**: ฝัง 4 กฎเหล็กใน System Prompt (`NO MAGIC`, `DOUBLE-CHECK`, `MINIMAL CODE FIRST`, `ITERATIVE EXECUTION`) ป้องกัน AI เดาสุ่มหรือทิ้งโค้ดขยะ
- **Omni-Surface Interfaces**: เลือกทำงานได้ 3 รูปแบบตามความถนัด ทั้ง Desktop (Electron), Web Browser/Remote และ Terminal TUI (`fdcode`)
- **Interactive Setup Wizard**: สั่ง `fdcode init` หรือ `fdcode config` เพื่อเลือก Provider, ทดสอบการเชื่อมต่อ (Ping) และบันทึกลง `.env` หรือ config สากลได้ใน 30 วินาที

---

## สารบัญ

- [เริ่มต้นใช้งานด่วน](#เริ่มต้นใช้งานด่วน)
- [รูปแบบการรัน (3 Interfaces)](#รูปแบบการรัน-3-interfaces)
- [การตั้งค่าโมเดล (Provider & BYOK)](#การตั้งค่าโมเดล-provider--byok)
- [การคุมบริบทด้วย .fdcodeignore](#การคุมบริบทด้วย-fdcodeignore)
- [สถาปัตยกรรมระบบ (Monorepo)](#สถาปัตยกรรมระบบ-monorepo)
- [คำสั่งสำหรับนักพัฒนา](#คำสั่งสำหรับนักพัฒนา)
- [ลิขสิทธิ์และการอ้างอิง](#ลิขสิทธิ์และการอ้างอิง)

---

## เริ่มต้นใช้งานด่วน

### ความต้องการของระบบ
- **Node.js**: `24.x` (อิงตาม [mise.toml](mise.toml))
- **pnpm**: `10.x`
- **Git**

### 1. ติดตั้งและบิลด์โปรเจกต์
```bash
# ติดตั้ง dependencies และคอมไพล์ dependencies เริ่มต้น
pnpm install
pnpm bootstrap
```

### 2. รัน Setup Wizard เพื่อผูกโมเดล AI
```bash
# รันตัวช่วยตั้งค่าแบบ Interactive (Ollama, LM Studio, DeepSeek, OpenAI, etc.)
node apps/zcode-cli/packages/cli/dist/zcode.cjs init
```

### 3. เริ่มใช้งานทันที
```bash
# เปิดใช้งาน Terminal TUI
node apps/zcode-cli/packages/cli/dist/zcode.cjs

# หรือเปิด Electron Desktop
pnpm dev:desktop
```

> **Tip**: รัน `npm link` ในโฟลเดอร์นี้เพื่อใช้คำสั่ง `fdcode` ได้จากทุกโฟลเดอร์ในเครื่องทันที

---

## รูปแบบการรัน (3 Interfaces)

| Interface | คำสั่งเรียกใช้ | คำอธิบาย |
| :--- | :--- | :--- |
| **Terminal TUI / CLI** | `fdcode` หรือ `pnpm --filter @zcode/cli dev` | ทำงานใน Terminal โดยตรง น้ำหนักเบา เร็ว และประหยัดทรัพยากร |
| **Desktop App** | `pnpm dev:desktop` | Electron Application เต็มรูปแบบ รองรับ Workspace และระบบ Multi-tab |
| **Web / Remote Client** | `pnpm dev:web` | เปิด Web Client บนเบราว์เซอร์ (`http://localhost:5173`) สำหรับรันบนเซิร์ฟเวอร์หรือเครื่องระยะไกล |

---

## การตั้งค่าโมเดล (Provider & BYOK)

FDCode รองรับทั้ง Local LLM และ Remote API ผ่านมาตรฐาน OpenAI-Compatible:

### 1. ใช้งาน Local LLMs (แนะนำ)
- **Ollama**: รัน `ollama run qwen2.5-coder:32b` หรือ `deepseek-r1:14b` จากนั้นเลือก Ollama ใน `fdcode init` (Base URL: `http://localhost:11434/v1`)
- **LM Studio**: โหลดโมเดลใน LM Studio แล้วกด Start Local Server จากนั้นเลือก LM Studio ใน `fdcode init` (Base URL: `http://localhost:1234/v1`)

### 2. ใช้งาน Remote API (BYOK)
รองรับ DeepSeek, OpenAI, OpenRouter หรือ Custom Endpoint โดยคีย์จะถูกเก็บไว้อย่างปลอดภัยใน:
- **Project-level**: ไฟล์ `.env` ใน Root ของแต่ละโปรเจกต์
- **Global-level**: `~/.fdcode/cli/config.json` สำหรับใช้ทุกโปรเจกต์ร่วมกัน

---

## การคุมบริบทด้วย .fdcodeignore

FDCode ใช้ไฟล์ `.fdcodeignore` เพื่อระบุไฟล์ที่ไม่ต้องการให้ Agent ดึงเข้า Context (เช่น บันทึกการเทส, ไฟล์ชั่วคราว, build output)
- ใช้ไวยากรณ์เดียวกับ `.gitignore`
- มีระบบ Backward-compatible อัตโนมัติ: หากโปรเจกต์มีไฟล์ `.zcodeignore` เดิม ระบบจะโหลดให้อัตโนมัติโดยไม่ต้องเปลี่ยนชื่อไฟล์

---

## สถาปัตยกรรมระบบ (Monorepo)

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

## คำสั่งสำหรับนักพัฒนา

```bash
# ตรวจสอบ Type ทั่วทั้ง Workspace
pnpm typecheck

# ตรวจสอบ Code Quality & Linters
pnpm lint

# ตรวจสอบกฎทางสถาปัตยกรรม (Module Boundaries)
pnpm architecture:check --changed

# ตรวจสอบความพร้อมก่อน Push โค้ด
pnpm verify:pre-push

# บิลด์ CLI Executable
pnpm --filter @zcode/cli build
```

---

## ลิขสิทธิ์และการอ้างอิง

FDCode พัฒนาต่อยอดมาจาก ZCode v3.14.0 ภายใต้สัญญาอนุญาต **Apache License 2.0** รายละเอียดเกี่ยวกับลิขสิทธิ์ต้นทางและ Third-Party Notices ทั้งหมดสามารถอ่านเพิ่มเติมได้ที่ [NOTICE.md](NOTICE.md) และ [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)
