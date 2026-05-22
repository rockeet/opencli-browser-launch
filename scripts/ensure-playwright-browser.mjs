#!/usr/bin/env node
/**
 * ensure-playwright-browser.mjs
 *
 * Ensures the Playwright-managed Chromium binary is installed in the user
 * directory (~/.opencli/playwright-browsers/).
 *
 * Playwright usage: ONLY getChromiumExecutablePath() — no runtime APIs.
 *
 * Output: JSON { ok, browsersPath, executable, installed }
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { scriptsDir, playwrightBrowsersPath, getChromiumExecutablePath } from './lib/paths.mjs';

function fail(msg) {
  process.stderr.write(`[ensure-playwright-browser] ERROR: ${msg}\n`);
  process.exit(1);
}

// ── Ensure scripts deps first ─────────────────────────────────────────────────
const depsResult = spawnSync('node', ['ensure-scripts-deps.mjs'], {
  cwd: scriptsDir(),
  stdio: ['ignore', 'pipe', 'inherit'],
  encoding: 'utf8',
});
if (depsResult.status !== 0) {
  fail('ensure-scripts-deps failed');
}

// ── Check if Chromium executable exists ──────────────────────────────────────
const browsersPath = playwrightBrowsersPath();
let executablePath;
let installed = false;

try {
  executablePath = await getChromiumExecutablePath();
} catch (e) {
  // playwright module not yet installed — shouldn't happen after ensure-deps
  fail(`Could not import playwright: ${e.message}`);
}

if (!existsSync(executablePath)) {
  process.stderr.write('[ensure-playwright-browser] Chromium not found — installing...\n');

  const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath };
  const result = spawnSync(
    'pnpm',
    ['exec', 'playwright', 'install', 'chromium'],
    {
      cwd: scriptsDir(),
      env,
      stdio: 'inherit',
      shell: true,
    }
  );

  if (result.status !== 0) {
    fail('pnpm exec playwright install chromium failed');
  }

  // Re-resolve path after installation
  try {
    executablePath = await getChromiumExecutablePath();
  } catch (e) {
    fail(`Could not resolve executable path after install: ${e.message}`);
  }

  installed = true;
}

if (!existsSync(executablePath)) {
  fail(`Chromium executable not found at: ${executablePath}`);
}

console.log(JSON.stringify({
  ok: true,
  browsersPath,
  executable: executablePath,
  installed,
}));
