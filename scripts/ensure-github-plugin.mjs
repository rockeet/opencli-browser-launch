#!/usr/bin/env node
/**
 * ensure-github-plugin.mjs
 *
 * Installs the GitHub opencli plugin for browser-based GitHub access.
 *
 * opencli 1.8.0 rejects ByteYue's pure-YAML plugin at install time.
 * Fallback: bundled TS adapter at ../plugins/github-trending/ (same logic).
 *
 * Output: JSON { ok, path, installed, method }
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundledPlugin = join(__dirname, '..', 'plugins', 'github-trending');
const pluginDir = join(os.homedir(), '.opencli', 'plugins', 'github-trending');

function fail(msg) {
  process.stderr.write(`[ensure-github-plugin] ERROR: ${msg}\n`);
  process.exit(1);
}

function isPluginReady(dir) {
  return existsSync(join(dir, 'repos.ts')) || existsSync(join(dir, 'repos.js'));
}

let installed = false;
let method = 'existing';

// Check if already installed and working
const listResult = spawnSync('opencli', ['plugin', 'list'], { encoding: 'utf8', shell: true });
const alreadyListed = (listResult.stdout ?? '').includes('github-trending');

if (alreadyListed && isPluginReady(pluginDir)) {
  process.stderr.write(`[ensure-github-plugin] github-trending already installed at ${pluginDir}\n`);
} else {
  // Try official YAML plugin first
  process.stderr.write('[ensure-github-plugin] Trying official plugin: github:ByteYue/opencli-plugin-github-trending\n');
  const official = spawnSync(
    'opencli',
    ['plugin', 'install', 'github:ByteYue/opencli-plugin-github-trending'],
    { encoding: 'utf8', shell: true }
  );

  if (official.status === 0 && isPluginReady(pluginDir)) {
    method = 'official';
    installed = true;
    process.stderr.write('[ensure-github-plugin] Official plugin installed\n');
  } else {
    // Fallback: bundled TS plugin via file://
    if (!existsSync(join(bundledPlugin, 'repos.ts'))) {
      fail(`Bundled plugin not found at ${bundledPlugin}`);
    }

    const fileUrl = 'file:///' + bundledPlugin.replace(/\\/g, '/');
    process.stderr.write(`[ensure-github-plugin] Installing bundled TS fallback: ${fileUrl}\n`);

    const fallback = spawnSync(
      'opencli',
      ['plugin', 'install', fileUrl],
      { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    if (fallback.status !== 0) {
      process.stderr.write(`[ensure-github-plugin] install stderr: ${fallback.stderr}\n`);
      fail('Bundled TS plugin install failed');
    }

    method = 'bundled-ts-fallback';
    installed = true;
    process.stderr.write('[ensure-github-plugin] Bundled TS plugin installed\n');
  }
}

console.log(JSON.stringify({ ok: true, path: pluginDir, installed, method }));
