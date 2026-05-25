---
name: opencli-browser-launch
description: >-
  自动 bootstrap 并启动 OpenCLI 专用 Chromium profile（含 Browser Bridge 扩展），
  通过 opencli doctor 验收后交 opencli-browser 做页面操作。
  当需要启动 opencli 浏览器、doctor 未绿、或依赖技能要求 bootstrap 浏览器时使用。
---

# opencli-browser-launch

**用途**：自动 bootstrap 并启动一个专有 Chromium profile（带 Browser Bridge 扩展），供 `opencli browser` 控制。

> **⚠️ Playwright 硬边界**：本 skill 中 Playwright **仅用于**：
> 1. `pnpm exec playwright install chromium` — 安装 Chromium 二进制
> 2. `chromium.executablePath()` — 获取二进制路径
>
> **禁止**：`launchPersistentContext`、`page.*`、`waitForEvent`、任何 Playwright 运行时 API。
>
> **浏览器启动**：`child_process.spawn({ detached: true })` — Node 退出后浏览器独立存活。
>
> **包管理**：`pnpm` only，禁止 npm/npx/yarn/bun。

---

## 前置条件

- Node >= 20
- `pnpm` 在 PATH（`pnpm -v` 可用）

> **opencli 和 daemon 会自动安装/启动**——`ensure-opencli.mjs` 会：
> 1. 检测 `opencli --version`，缺失则 `pnpm add -g @jackwener/opencli`
> 2. 检测 `opencli daemon status`，未运行则 `opencli daemon` 启动
>
> 用户无需手动安装 opencli 或启动 daemon。

---

## 使用方式

### 标准启动（推荐）

```powershell
# Windows
node ~/.cursor/skills/opencli-browser-launch/scripts/launch-browser.mjs

# 或使用封装脚本
~/.cursor/skills/opencli-browser-launch/scripts/launch-browser.ps1
```

```bash
# macOS/Linux
~/.cursor/skills/opencli-browser-launch/scripts/launch-browser.sh
```

### 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--profile <name>` | `opencli` | Chrome profile 名称（对应 `~/.opencli/chrome-profiles/<name>/`） |
| `--wait-seconds <n>` | `30` | 等待 `opencli doctor` 连通的超时秒数 |
| `--secure` | 未传 | 禁用 web-security 宽松参数（默认开启宽松） |
| `--optimize-extension-args` | 未传 | 若 profile 已注册扩展则省略 `--load-extension`（默认：始终传） |

### 单独 ensure 步骤

```powershell
# 检查/安装 Node 依赖
node scripts/ensure-scripts-deps.mjs

# 安装/检查 Playwright Chromium
node scripts/ensure-playwright-browser.mjs

# 安装/检查 Browser Bridge 扩展
node scripts/ensure-extension.mjs [--force] [--version 1.0.15]
```

---

## 工作流

```
Agent 触发
  │
  ├─ ensure-opencli.mjs        ← pnpm add -g @jackwener/opencli + daemon（首次）
  ├─ ensure-scripts-deps.mjs   ← pnpm install playwright（首次）
  ├─ ensure-playwright-browser.mjs  ← pnpm exec playwright install chromium（首次）
  ├─ ensure-extension.mjs      ← 下载/解压扩展到 ~/.opencli/browser-bridge-extension/
  │
  ├─ opencli doctor 已连通？
  │    └─ YES → already-connected（exit 0）
  │
  ├─ launcher.pid 进程存活？
  │    └─ YES → already-running（exit 0）
  │
  ├─ getChromiumExecutablePath()  ← Playwright 仅此一用
  ├─ child_process.spawn (detached + unref)
  ├─ 早死检测（2s）
  ├─ 写 launcher.pid / launcher.json
  ├─ 轮询 opencli doctor（最多 --wait-seconds）
  │
  └─ Node 退出 — 浏览器独立存活
       │
       └─ 切换至 opencli-browser skill
```

---

## 扩展架构（业内最佳实践）

| 层级 | 位置 | 职责 |
|------|------|------|
| 扩展源（单一真相源） | `~/.opencli/browser-bridge-extension/` | ensure-extension 下载解压、版本升级 |
| Profile | `~/.opencli/chrome-profiles/<name>/` | 登录态、站点数据 |
| Launch 挂载 | 启动参数 | 默认每次 `--load-extension=<extDir>` + `--disable-extensions-except=<extDir>` |

扩展**不装进** profile 目录（非自动化业界惯例）。

---

## 与 opencli-browser 分工

```
opencli-browser-launch              opencli-browser
──────────────────────              ─────────────────
pnpm / playwright install           opencli browser open/state/click/...
executablePath() 路径查询            结构化 envelope
child_process.spawn (detached)      页面自动化
extDir + load-extension             唯一驱动面
doctor 轮询验收
禁止 Playwright 运行时 API
```

**launch 完成后必须切换至 `opencli-browser` skill 进行页面操作。**

---

## 目录结构

```
~/.cursor/skills/opencli-browser-launch/
├── SKILL.md                     本文件
├── scripts/
│   ├── package.json             dependencies: { playwright: ^1.49.0 }
│   ├── pnpm-lock.yaml
│   ├── .gitignore               node_modules/
│   ├── lib/
│   │   └── paths.mjs            路径工具（opencliHome, extensionPath, profilePath, ...)
│   ├── ensure-scripts-deps.mjs  Node/pnpm 检查 + playwright 包安装
│   ├── ensure-playwright-browser.mjs  Chromium 二进制安装（~/.opencli/playwright-browsers/）
│   ├── ensure-extension.mjs     扩展检测/下载/解压（纯 Node，不启动浏览器）
│   ├── launch-browser.mjs       主入口：spawn + doctor 轮询
│   ├── launch-browser.ps1       Windows 封装
│   ├── launch-browser.sh        macOS/Linux 封装
│   ├── ensure-extension.ps1     Windows ensure 封装
│   └── ensure-extension.sh      macOS/Linux ensure 封装
└── references/
    ├── paths.md                 路径速查
    ├── troubleshooting.md       排障手册
    └── extension-install-research.md  扩展架构调研 + PoC 实测
```

---

## 路径速查

| 名称 | 路径 |
|------|------|
| Chromium 二进制 | `~/.opencli/playwright-browsers/chromium-*/chrome-win64/chrome.exe` |
| 扩展源 | `~/.opencli/browser-bridge-extension/` |
| Profile | `~/.opencli/chrome-profiles/<name>/` |
| launcher.pid | `~/.opencli/chrome-profiles/<name>/launcher.pid` |
| launcher.json | `~/.opencli/chrome-profiles/<name>/launcher.json` |
| zip 缓存 | `~/.opencli/opencli-extension.zip` |
| update-check | `~/.opencli/update-check.json` |

---

## 常见问题

见 `references/troubleshooting.md`。
