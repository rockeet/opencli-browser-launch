#!/usr/bin/env node
/**
 * ensure-extension.mjs
 *
 * Ensures the OpenCLI Browser Bridge extension is available at
 * ~/.opencli/browser-bridge-extension/ (outside any Chrome profile).
 *
 * Does NOT start a browser — pure Node.js (fetch + extract).
 *
 * Usage:
 *   node ensure-extension.mjs [--force] [--version <ver>]
 *
 * Output: JSON { ok, path, version, installed }
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { extensionPath, opencliHome } from './lib/paths.mjs';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const forceInstall = args.includes('--force');
const versionArgIdx = args.indexOf('--version');
const requestedVersion = versionArgIdx !== -1 ? args[versionArgIdx + 1] : null;

function fail(msg) {
  process.stderr.write(`[ensure-extension] ERROR: ${msg}\n`);
  process.exit(1);
}

// ── Resolve desired extension version ────────────────────────────────────────
function getDesiredVersion() {
  if (requestedVersion) return requestedVersion;

  const updateCheckPath = join(opencliHome(), 'update-check.json');
  if (existsSync(updateCheckPath)) {
    try {
      const data = JSON.parse(readFileSync(updateCheckPath, 'utf8'));
      if (data.latestExtensionVersion) return data.latestExtensionVersion;
    } catch {
      // fall through
    }
  }

  // Fallback: check existing manifest
  const extDir = extensionPath();
  const manifestPath = join(extDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (m.version) return m.version;
    } catch {
      // fall through
    }
  }

  return null;
}

// ── Check if extension is already installed at desired version ────────────────
function isExtensionCurrent(desiredVersion) {
  const extDir = extensionPath();
  const manifestPath = join(extDir, 'manifest.json');
  const bgPath = join(extDir, 'dist', 'background.js');

  if (!existsSync(manifestPath) || !existsSync(bgPath)) return false;

  if (!desiredVersion) return true; // can't compare, assume ok

  try {
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return m.version === desiredVersion;
  } catch {
    return false;
  }
}

// ── Download zip ──────────────────────────────────────────────────────────────
async function downloadZip(version) {
  const url = `https://github.com/jackwener/OpenCLI/releases/download/v${version}/opencli-extension-v${version}.zip`;
  const zipPath = join(opencliHome(), 'opencli-extension.zip');

  process.stderr.write(`[ensure-extension] Downloading extension v${version}...\n`);
  process.stderr.write(`[ensure-extension] URL: ${url}\n`);

  const res = await fetch(url);
  if (!res.ok) {
    fail(`Download failed: HTTP ${res.status} from ${url}`);
  }

  const buffer = await res.arrayBuffer();
  writeFileSync(zipPath, Buffer.from(buffer));
  process.stderr.write(`[ensure-extension] Downloaded ${buffer.byteLength} bytes to ${zipPath}\n`);
  return zipPath;
}

// ── Extract zip ───────────────────────────────────────────────────────────────
function extractZip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });

  const platform = os.platform();
  let result;

  if (platform === 'win32') {
    result = spawnSync(
      'powershell',
      ['-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`],
      { stdio: 'inherit', encoding: 'utf8' }
    );
  } else {
    result = spawnSync(
      'unzip',
      ['-o', zipPath, '-d', destDir],
      { stdio: 'inherit', encoding: 'utf8' }
    );
  }

  if (result.status !== 0) {
    fail(`Extraction failed (exit code ${result.status})`);
  }
}

// ── Verify extraction ─────────────────────────────────────────────────────────
function verifyExtraction() {
  const extDir = extensionPath();
  const manifestPath = join(extDir, 'manifest.json');
  const bgPath = join(extDir, 'dist', 'background.js');

  if (!existsSync(manifestPath)) fail(`manifest.json not found after extraction: ${manifestPath}`);
  if (!existsSync(bgPath)) fail(`dist/background.js not found after extraction: ${bgPath}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const desiredVersion = getDesiredVersion();
const extDir = extensionPath();
let installed = false;

if (!forceInstall && isExtensionCurrent(desiredVersion)) {
  // Already at desired version
  process.stderr.write(`[ensure-extension] Extension v${desiredVersion} already installed at ${extDir}\n`);
} else {
  if (!desiredVersion) {
    fail(
      'Cannot determine desired extension version. ' +
      'Ensure ~/.opencli/update-check.json exists or pass --version <ver>.'
    );
  }

  const zipPath = await downloadZip(desiredVersion);
  extractZip(zipPath, extDir);
  verifyExtraction();
  installed = true;
  process.stderr.write(`[ensure-extension] Extension v${desiredVersion} installed at ${extDir}\n`);
}

// Read installed version from manifest
let installedVersion = desiredVersion ?? 'unknown';
try {
  const m = JSON.parse(readFileSync(join(extDir, 'manifest.json'), 'utf8'));
  installedVersion = m.version ?? installedVersion;
} catch {
  // non-fatal
}

console.log(JSON.stringify({
  ok: true,
  path: extDir,
  version: installedVersion,
  installed,
}));
