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
# Windows
node ~/.cursor/skills/opencli-browser-launch/scripts/launch-browser.mjs

# Or wrapper
~/.cursor/skills/opencli-browser-launch/scripts/launch-browser.ps1
```

```bash
# macOS / Linux
~/.cursor/skills/opencli-browser-launch/scripts/launch-browser.sh
```

## Publish to GitHub (self-demo)

This skill can publish itself to GitHub using its own bootstrap flow:

```powershell
cd ~/.cursor/skills/opencli-browser-launch/scripts
.\publish-to-github.ps1 -Public
```

The publish script:
1. Runs `launch-browser.ps1` (this skill)
2. Uses `opencli browser open` to smoke-test GitHub access
3. `git commit` + `gh repo create` + push
4. Opens the repo page in browser to confirm

## Directory layout

```
opencli-browser-launch/
├── SKILL.md                          Agent skill instructions
├── README.md                         This file
├── scripts/
│   ├── launch-browser.mjs            Main entry (spawn + doctor poll)
│   ├── launch-browser.ps1 / .sh      Platform wrappers
│   ├── ensure-*.mjs                  Ensure chain (deps, browser, extension)
│   ├── publish-to-github.ps1         Self-publish workflow
│   └── lib/paths.mjs                 Path helpers
└── references/
    ├── extension-install-research.md PoC results
    ├── paths.md                      Path reference
    └── troubleshooting.md            Troubleshooting
```

## Prerequisites

- Node >= 20, pnpm, opencli (global)
- `opencli daemon` running (default `localhost:19825`)
- For publish: `gh` CLI authenticated

## License

MIT
