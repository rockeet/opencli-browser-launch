# opencli-browser-launch

Cursor Agent Skill — bootstrap a dedicated Chromium profile with the OpenCLI Browser Bridge extension, then hand off page automation to `opencli browser`.

## What it does

1. **Ensure opencli** — install `@jackwener/opencli` via pnpm if missing; start daemon if not running
2. **Ensure deps** — `pnpm install playwright`, install Chromium to `~/.opencli/playwright-browsers/`
3. **Ensure extension** — download/extract Browser Bridge to `~/.opencli/browser-bridge-extension/`
4. **Launch browser** — `child_process.spawn` (detached); Node exits, browser stays alive
5. **Verify** — poll `opencli doctor` until Extension connected
6. **Hand off** — switch to `opencli-browser` skill for page automation

## Dependencies (all auto-installed)

| Dependency | Auto-install method |
|------------|-------------------|
| `@jackwener/opencli` | `pnpm add -g @jackwener/opencli` |
| opencli daemon | `opencli daemon` (auto-started) |
| Playwright + Chromium | `pnpm install` + `playwright install chromium` |
| Browser Bridge extension | Download from GitHub Releases |

**User only needs**: Node >= 20 and pnpm in PATH.

## Install

```bash
npx skills add rockeet/opencli-browser-launch --skill opencli-browser-launch
```

Or clone:

```bash
git clone https://github.com/rockeet/opencli-browser-launch.git \
  ~/.cursor/skills/opencli-browser-launch
cd ~/.cursor/skills/opencli-browser-launch/scripts
pnpm install
```

## Quick start

```powershell
node ~/.cursor/skills/opencli-browser-launch/scripts/launch-browser.mjs
```

## Prerequisites

- Node >= 20
- pnpm in PATH

Everything else (opencli, daemon, Chromium, extension) is auto-installed on first run.

## Related skills

- **opencli-github-publish** — publish local projects to GitHub (uses this skill)
- **opencli-browser** — page automation after launch

## License

MIT
