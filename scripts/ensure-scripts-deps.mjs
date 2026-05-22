#!/usr/bin/env node
/**
 * ensure-scripts-deps.mjs
 *
 * Checks Node >= 20 and pnpm availability, then installs playwright package
 * if node_modules/playwright is missing.
 *
 * Output: JSON { ok, packageManager, playwrightVersion, installed }
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { scriptsDir } from './lib/paths.mjs';

function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, encoding: 'utf8', ...opts });
}

function fail(msg) {
  process.stderr.write(`[ensure-scripts-deps] ERROR: ${msg}\n`);
  process.exit(1);
}

// ── Node version check ────────────────────────────────────────────────────────
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 20) {
  fail(`Node >= 20 required, got ${process.versions.node}`);
}

// ── pnpm availability ─────────────────────────────────────────────────────────
const pnpmResult = run('pnpm -v');
if (pnpmResult.status !== 0) {
  fail('pnpm not found in PATH. Install pnpm: https://pnpm.io/installation');
}
const pnpmVersion = pnpmResult.stdout.trim();

// ── playwright package ────────────────────────────────────────────────────────
const dir = scriptsDir();
const playwrightPkg = join(dir, 'node_modules', 'playwright', 'package.json');
let installed = false;

if (!existsSync(playwrightPkg)) {
  process.stderr.write('[ensure-scripts-deps] playwright not found — running pnpm install...\n');

  // Try frozen first (respects lockfile), fall back to regular install
  const frozen = run('pnpm install --frozen-lockfile', { cwd: dir });
  if (frozen.status !== 0) {
    const regular = run('pnpm install', { cwd: dir });
    if (regular.status !== 0) {
      fail(`pnpm install failed:\n${regular.stderr}`);
    }
  }
  installed = true;
}

// ── Read installed playwright version ────────────────────────────────────────
let playwrightVersion = 'unknown';
try {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const pwPkg = require(join(dir, 'node_modules', 'playwright', 'package.json'));
  playwrightVersion = pwPkg.version;
} catch {
  // non-fatal
}

console.log(JSON.stringify({
  ok: true,
  packageManager: `pnpm ${pnpmVersion}`,
  playwrightVersion,
  installed,
}));
