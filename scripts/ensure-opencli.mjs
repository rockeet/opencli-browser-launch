#!/usr/bin/env node
/**
 * ensure-opencli.mjs
 *
 * Ensures opencli CLI and daemon are available and running.
 * Auto-installs via pnpm if missing; auto-starts daemon if not running.
 *
 * Dependency chain:
 *   Node >= 20 → pnpm → @jackwener/opencli (global) → opencli daemon
 *
 * Output: JSON { ok, version, daemonRunning, installed, daemonStarted }
 */
import { spawnSync } from 'node:child_process';

function run(cmd, args = [], opts = {}) {
  return spawnSync(cmd, args, { shell: true, encoding: 'utf8', timeout: 30000, ...opts });
}

function fail(msg) {
  process.stderr.write(`[ensure-opencli] ERROR: ${msg}\n`);
  process.exit(1);
}

function log(msg) {
  process.stderr.write(`[ensure-opencli] ${msg}\n`);
}

// ── Node >= 20 ────────────────────────────────────────────────────────────────
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 20) {
  fail(`Node >= 20 required, got ${process.versions.node}`);
}

// ── pnpm ──────────────────────────────────────────────────────────────────────
const pnpmCheck = run('pnpm', ['-v']);
if (pnpmCheck.status !== 0) {
  fail('pnpm not found in PATH. Install: https://pnpm.io/installation');
}

// ── opencli ───────────────────────────────────────────────────────────────────
let installed = false;
let opencliVersion = '';

const versionCheck = run('opencli', ['--version']);
if (versionCheck.status !== 0) {
  log('opencli not found — installing @jackwener/opencli globally via pnpm...');

  const install = run('pnpm', ['add', '-g', '@jackwener/opencli']);
  if (install.status !== 0) {
    fail(`pnpm add -g @jackwener/opencli failed:\n${install.stderr}`);
  }
  installed = true;

  const recheck = run('opencli', ['--version']);
  if (recheck.status !== 0) {
    fail(
      'opencli installed but not found in PATH.\n' +
      '  Ensure pnpm global bin is in PATH: pnpm bin -g\n' +
      '  Add to PATH and restart terminal.'
    );
  }
  opencliVersion = recheck.stdout.trim();
  log(`Installed opencli v${opencliVersion}`);
} else {
  opencliVersion = versionCheck.stdout.trim();
  log(`opencli v${opencliVersion} found`);
}

// ── daemon ────────────────────────────────────────────────────────────────────
let daemonRunning = false;
let daemonStarted = false;

const daemonStatus = run('opencli', ['daemon', 'status']);
const statusOutput = ((daemonStatus.stdout ?? '') + (daemonStatus.stderr ?? '')).toLowerCase();

if (daemonStatus.status === 0 && statusOutput.includes('running')) {
  daemonRunning = true;
  log('Daemon already running');
} else {
  log('Daemon not running — starting...');

  // opencli daemon starts in background by default
  const daemonStart = run('opencli', ['daemon'], { timeout: 15000 });

  // Wait a moment then re-check
  await new Promise(r => setTimeout(r, 2000));
  const recheck = run('opencli', ['daemon', 'status']);
  const recheckOut = ((recheck.stdout ?? '') + (recheck.stderr ?? '')).toLowerCase();

  if (recheck.status === 0 && recheckOut.includes('running')) {
    daemonRunning = true;
    daemonStarted = true;
    log('Daemon started');
  } else {
    log('WARNING: daemon may not have started. Continue anyway — doctor will verify later.');
    log(`  daemon status output: ${recheckOut.slice(0, 300)}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  version: opencliVersion,
  daemonRunning,
  installed,
  daemonStarted,
}));
