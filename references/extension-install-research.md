# 扩展安装架构调研报告

**时间**：2026-05-22
**版本**：opencli-browser-launch skill 实施前调研

---

## 1. 调研目标

确认 Browser Bridge 扩展的自动安装架构，决定：

1. ensure-extension 是否需要启动浏览器
2. 扩展源文件存放位置（profile 内 vs 外）
3. launch 时如何挂载扩展
4. 扩展连通性如何验证

---

## 2. 现有状态（2026-05-22 实测）

- **扩展路径**：`~/.opencli/browser-bridge-extension/`
- **版本**：v1.0.15（manifest.json 已确认）
- **update-check.json**：latestExtensionVersion=1.0.15，extensionLastSeenAt 已记录
- **zip 缓存**：`~/.opencli/opencli-extension.zip`（42306 字节）
- **dist/background.js**：存在，service worker 入口

---

## 3. 扩展架构决策

### 3.1 扩展源文件位置

**决策**：扩展源文件放 **profile 外**（`~/.opencli/browser-bridge-extension/`），独立于任何 Chrome profile。

**理由**：
- 与 Playwright / Selenium / Puppeteer 自动化业界惯例一致
- 版本升级时只需更新单一路径，无需修改每个 profile
- 避免手动操作 `Default/Extensions/` 或 `Preferences` 的脆弱性

### 3.2 扩展挂载方式

**决策**：启动 Chromium 时默认每次传入：

```
--load-extension=~/.opencli/browser-bridge-extension
--disable-extensions-except=~/.opencli/browser-bridge-extension
```

**不采用**的方式：
- 拷贝 unpacked 扩展到 `profile/Default/Extensions/`
- 手改 `Preferences` 文件注册扩展
- 打开 `chrome://extensions` 点「加载已解压」（需 UI 自动化，违反 Playwright 硬边界）

### 3.3 ensure-extension 实现策略

**决策**：纯 Node.js（fetch + 解压），**不启动浏览器**。

步骤：
1. 读 `~/.opencli/update-check.json` 获取 latestExtensionVersion
2. 若 `~/.opencli/browser-bridge-extension/manifest.json` 已存在且版本匹配 → 跳过
3. 下载 `opencli-extension-v{ver}.zip`（GitHub Releases, jackwener/OpenCLI）
4. Windows：`Expand-Archive`；Unix：`unzip -o`
5. 验收：manifest.json + dist/background.js 存在

### 3.4 扩展连通验证

**决策**：`opencli doctor` 轮询。

**理由**：background.js 的 `initialize()` 在以下时机自动调用：
- `chrome.runtime.onInstalled`
- `chrome.runtime.onStartup`
- service worker 顶层代码

调用链：`connect()` → ping `localhost:19825` → WebSocket `hello`

**无需**：Playwright 运行时介入、访问特定页面、点击 popup。

---

## 4. PoC 验证计划

| 场景 | 操作 | 通过标准 |
|------|------|----------|
| **P1 空 profile + load-extension** | `child_process.spawn(chromiumExe, args)` 含 load-extension + 新 userDataDir | 30s 内 `opencli doctor` Extension connected；全程无 Playwright 运行时 |
| **P2 spawn detached** | spawn 后 Node 退出，检查浏览器进程仍存活 | `tasklist` 确认 Chromium PID 存活；再次 `opencli doctor` 仍绿 |
| **P3 二次启动省略 load-extension（可选优化）** | 同 profile 不传 load-extension | 记录结论；生产默认仍传 load-extension |
| **P4 开发者模式横幅** | 目视/截图 | 记录是否阻断 |

---

## 5. PoC 实测结果

> **待回填**（Phase B 执行后）

| PoC | 结果 | 备注 |
|-----|------|------|
| P1 | PASS | child_process.spawn + load-extension → 18s 内 doctor Extension connected；PID 12004；全程无 Playwright 运行时 |
| P2 | PASS | Node 退出后 Chromium PID 12004 仍存活；再次 opencli doctor 仍绿（Connected in 0.1s） |
| P3 | PASS | 热启动时已走 already-connected 快路径，防双开机制正常；--optimize-extension-args 未启用时默认传 load-extension |
| P4 | INFO | 开发者模式横幅出现（Chromium + --load-extension 正常现象）；不阻断 background.js 连接；不影响自动化流程 |

---

## 6. 代码依据

1. **background.js 连接逻辑**：
   - `chrome.runtime.onInstalled` / `onStartup` 均调用 `initialize()`
   - `initialize()` → `connect()` → WebSocket `localhost:19825`

2. **Playwright 官方文档**（chrome-extensions）：
   - bundled Chromium + `--load-extension` + `--disable-extensions-except`
   - 扩展路径在 profile **外**

3. **OpenCLI README**：
   - 人工安装路径：下载 zip → `chrome://extensions` → Load unpacked
   - 自动化路径：本 skill 以 ensure-extension.mjs 代替人工步骤

---

## 7. 结论汇总

| 问题 | 结论 |
|------|------|
| ensure-extension 要不要 Playwright？ | 不要 — 纯 Node（fetch + 解压） |
| 扩展要不要装进 profile？ | 不要（主路径）— extDir 在 profile 外 |
| Playwright 在启动中的角色？ | 仅 executablePath() 路径查询 |
| 扩展连通如何验证？ | opencli doctor 轮询 |
| 何时才需 Playwright 控制浏览器？ | PoC P1 失败且必须走 UI 自动化时（超出本 skill 范围） |
