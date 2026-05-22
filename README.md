# opencli-browser-launch

Cursor Agent Skill — bootstrap a dedicated Chromium profile with the OpenCLI Browser Bridge extension, then hand off page automation to `opencli browser`.

## What it does

1. **Ensure deps** — `pnpm install playwright`, install Chromium to `~/.opencli/playwright-browsers/`
2. **Ensure extension** — download/extract Browser Bridge to `~/.opencli/browser-bridge-extension/` (outside profile)
3. **Launch browser** — `child_process.spawn` (detached); Node exits, browser stays alive
4. **Verify** — poll `opencli doctor` until Extension connected
5. **Hand off** — switch to `opencli-browser` skill for page automation

## Playwright hard boundary

| Allowed | Forbidden |
|---------|-----------|
| `pnpm exec playwright install chromium` | `launchPersistentContext` |
| `chromium.executablePath()` | `page.*`, `waitForEvent`, any runtime API |

## Install

```bash
npx skills add rockeet/opencli-browser-launch --skill opencli-browser-launch
```

Or clone manually:

```bash
git clone https://github.com/rockeet/opencli-browser-launch.git \
  ~/.cursor/skills/opencli-browser-launch
cd ~/.cursor/skills/opencli-browser-launch/scripts
pnpm install
```

## Quick start

```powershell
node ~/.cursor/skills/opencli-browser-launch/scripts/launch-browser.mjs
# Or: ~/.cursor/skills/opencli-browser-launch/scripts/launch-browser.ps1
```

## Related skills

- **opencli-github-publish** — publish local projects to GitHub (uses this skill for browser bootstrap)
- **opencli-browser** — page automation after launch

## Directory layout

```
opencli-browser-launch/
├── SKILL.md
├── scripts/
│   ├── launch-browser.mjs
│   ├── ensure-*.mjs
│   └── lib/paths.mjs
└── references/
```

## Prerequisites

- Node >= 20, pnpm, opencli (global)
- `opencli daemon` running (default `localhost:19825`)

## License

MIT
