/**
 * lib/paths.mjs — central path helpers for opencli-browser-launch
 *
 * IMPORTANT: getChromiumExecutablePath() sets PLAYWRIGHT_BROWSERS_PATH *before*
 * importing playwright, because Playwright reads the env at module-load time.
 */
import { join } from 'node:path';
import os from 'node:os';

/** Root directory for all opencli user data */
export function opencliHome() {
  return join(os.homedir(), '.opencli');
}

/** Where playwright installs bundled Chromium */
export function playwrightBrowsersPath() {
  return join(opencliHome(), 'playwright-browsers');
}

/** Where the browser-bridge extension source lives (outside any profile) */
export function extensionPath() {
  return join(opencliHome(), 'browser-bridge-extension');
}

/** Per-profile user data directory */
export function profilePath(name = 'opencli') {
  return join(opencliHome(), 'chrome-profiles', name);
}

/** Absolute path to the scripts/ directory itself */
export function scriptsDir() {
  return new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
}

/**
 * Resolve the Chromium executable path via playwright.
 * Sets PLAYWRIGHT_BROWSERS_PATH before importing playwright so the env is
 * read at module-load time (runtime assignment is too late).
 *
 * Returns the executable path string, or null if not yet installed.
 */
export async function getChromiumExecutablePath() {
  // Must be set before the dynamic import below
  process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightBrowsersPath();

  const { chromium } = await import('playwright');
  const execPath = chromium.executablePath();
  // Playwright usage ends here — no runtime APIs called after this point
  return execPath;
}
