# 路径速查

## 用户根目录

```
~/.opencli/
├── playwright-browsers/        Playwright 管理的 Chromium 二进制
│   └── chromium-1223/
│       └── chrome-win64/
│           └── chrome.exe
├── browser-bridge-extension/   扩展源（单一真相源，profile 外）
│   ├── manifest.json
│   ├── dist/background.js
│   ├── icons/
│   ├── popup.html
│   └── popup.js
├── chrome-profiles/            Chromium profile 目录
│   └── <name>/                 由 --profile <name> 指定（默认 opencli）
│       ├── launcher.pid        最近一次 spawn 的 Chromium PID
│       ├── launcher.json       launch 元数据（extVersion, loadExtensionUsed, ...）
│       └── Default/            Chromium profile 数据
├── opencli-extension.zip       扩展 zip 下载缓存
└── update-check.json           版本信息（latestExtensionVersion 等）
```

## 技能目录

```
~/.cursor/skills/opencli-browser-launch/
└── scripts/
    ├── node_modules/playwright/   playwright 包（pnpm 管理）
    └── lib/paths.mjs              路径 helper 函数
```

## 环境变量

| 变量 | 值 | 说明 |
|------|----|------|
| `PLAYWRIGHT_BROWSERS_PATH` | `~/.opencli/playwright-browsers` | 必须在 import('playwright') 之前设置 |
