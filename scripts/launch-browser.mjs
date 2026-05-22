#!/usr/bin/env node
/**
 * launch-browser.mjs
 *
 * Bootstrap and launch a dedicated Chromium profile with the OpenCLI
 * Browser Bridge extension, then hand off to opencli-browser for page automation.
 *
 * Playwright usage: ONLY getChromiumExecutablePath() — NO runtime APIs.
 * Browser is launched via child_process.spawn (detached) so it survives Node exit.
 *
 * Usage:
 *   node launch-browser.mjs [options]
 *
 * Options:
 *   --profile <name>             Chrome profile name (default: opencli)
 *   --wait-seconds <n>           Seconds to poll opencli doctor (default: 30)
 *   --secure                     Disable web-security relaxation args
 *   --optimize-extension-args    Skip --load-extension if already registered (default: false)
 *
 * Output: JSON { ok, status, pid, profile, extVersion, loadExtensionUsed, launchedAt }
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import { extensionPath, profilePath, scriptsDir, getChromiumExecutablePath } from './lib/paths.mjs';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function argValue(flag, def) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : def;
}
const profileName = argValue('--profile', 'opencli');
const waitSeconds = parseInt(argValue('--wait-seconds', '30'), 10);
const secureMode = args.includes('--secure');
const optimizeExtensionArgs = args.includes('--optimize-extension-args');

function fail(msg) {
  process.stderr.write(`[launch-browser] ERROR: ${msg}\n`);
  process.exit(1);
}

function log(msg) {
  process.stderr.write(`[launch-browser] ${msg}\n`);
}

// ── Security args (without extension args) ───────────────────────────────────
const SECURITY_ARGS = [
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
  '--allow-running-insecure-content',
  '--disable-site-isolation-trials',
  '--no-first-run',
  '--no-default-browser-check',
];

// ── Check if --load-extension is needed (PoC P3 optional optimization) ───────
function needsLoadExtension(profileDir, extDir) {
  if (!optimizeExtensionArgs) return true; // default: always load

  // Conservative: if we can't reliably detect, always load
  const prefsPath = join(profileDir, 'Default', 'Preferences');
  if (!existsSync(prefsPath)) return true;

  try {
    const prefs = JSON.parse(readFileSync(prefsPath, 'utf8'));
    const extensions = prefs?.extensions?.settings;
    if (!extensions) return true;

    const manifestPath = join(extDir, 'manifest.json');
    if (!existsSync(manifestPath)) return true;
    const extManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const desiredVersion = extManifest.version;

    for (const id of Object.keys(extensions)) {
      const ext = extensions[id];
      if (ext?.manifest?.version === desiredVersion && ext?.path?.includes('browser-bridge-extension')) {
        log(`Extension v${desiredVersion} already registered in profile — skipping --load-extension`);
        return false;
      }
    }
  } catch {
    // Parse failure → conservative: load
  }

  return true;
}

// ── Build launch args ─────────────────────────────────────────────────────────
function buildLaunchArgs({ extDir, userDataDir }) {
  const base = secureMode ? [] : [...SECURITY_ARGS];

  if (needsLoadExtension(userDataDir, extDir)) {
    base.push(
      `--load-extension=${extDir}`,
      `--disable-extensions-except=${extDir}`
    );
    return { args: base, loadExtensionUsed: true };
  }

  return { args: base, loadExtensionUsed: false };
}

// ── Poll opencli doctor ────────────────────────────────────────────────────────
async function pollDoctor(maxSeconds, extDir, userDataDir, pid, loadExtensionUsed) {
  const deadline = Date.now() + maxSeconds * 1000;
  let lastOutput = '';

  while (Date.now() < deadline) {
    const result = spawnSync('opencli', ['doctor', '--json'], {
      encoding: 'utf8',
      shell: true,
      timeout: 5000,
    });

    lastOutput = (result.stdout ?? '') + (result.stderr ?? '');

    // Check for extension connected
    const combinedOutput = lastOutput.toLowerCase();
    if (combinedOutput.includes('extension connected') || combinedOutput.includes('"extension":true') || combinedOutput.includes('"connected":true')) {
      log('opencli doctor: Extension connected!');
      return true;
    }

    // Also try without --json
    const result2 = spawnSync('opencli', ['doctor'], {
      encoding: 'utf8',
      shell: true,
      timeout: 5000,
    });
    const output2 = ((result2.stdout ?? '') + (result2.stderr ?? '')).toLowerCase();
    if (output2.includes('extension connected') || output2.includes('connected')) {
      log('opencli doctor: Extension connected!');
      return true;
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  // Timeout — print diagnostic info
  process.stderr.write('\n[launch-browser] ERROR: opencli doctor did not report Extension connected within ' + maxSeconds + 's\n');
  process.stderr.write(`  Daemon port: localhost:19825\n`);
  process.stderr.write(`  Extension dir: ${extDir}\n`);
  process.stderr.write(`  Profile dir: ${userDataDir}\n`);
  process.stderr.write(`  loadExtensionUsed: ${loadExtensionUsed}\n`);
  process.stderr.write(`  Chromium PID: ${pid}\n`);
  process.stderr.write(`  Last doctor output: ${lastOutput.slice(0, 500)}\n`);
  process.stderr.write(`\n  Tip: Make sure the opencli daemon is running: opencli daemon\n`);
  process.stderr.write(`  Tip: Try running manually: opencli doctor\n`);
  return false;
}

// ── Check if process is alive ─────────────────────────────────────────────────
function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    if (os.platform() === 'win32') {
      const r = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], {
        encoding: 'utf8', shell: true, timeout: 5000,
      });
      return r.stdout.includes(String(pid));
    } else {
      const r = spawnSync('kill', ['-0', String(pid)], {
        encoding: 'utf8', shell: false, timeout: 3000,
      });
      return r.status === 0;
    }
  } catch {
    return false;
  }
}

// ── Quick doctor check ────────────────────────────────────────────────────────
function quickDoctorCheck() {
  const result = spawnSync('opencli', ['doctor'], {
    encoding: 'utf8', shell: true, timeout: 5000,
  });
  const output = ((result.stdout ?? '') + (result.stderr ?? '')).toLowerCase();
  return output.includes('extension connected') || output.includes('connected');
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════

// ── Step 1: ensure chain ──────────────────────────────────────────────────────
log('Running ensure chain...');

const opencliResult = spawnSync('node', ['ensure-opencli.mjs'], {
  cwd: scriptsDir(), stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8',
});
if (opencliResult.status !== 0) fail('ensure-opencli failed');

const depsResult = spawnSync('node', ['ensure-scripts-deps.mjs'], {
  cwd: scriptsDir(), stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8',
});
if (depsResult.status !== 0) fail('ensure-scripts-deps failed');

const pwResult = spawnSync('node', ['ensure-playwright-browser.mjs'], {
  cwd: scriptsDir(), stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8',
});
if (pwResult.status !== 0) fail('ensure-playwright-browser failed');

const extResult = spawnSync('node', ['ensure-extension.mjs'], {
  cwd: scriptsDir(), stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8',
});
if (extResult.status !== 0) fail('ensure-extension failed');

let extInfo;
try {
  extInfo = JSON.parse(extResult.stdout.trim().split('\n').pop());
} catch {
  extInfo = { version: 'unknown' };
}
const extVersion = extInfo.version ?? 'unknown';

// ── Step 2: Quick path — already connected ────────────────────────────────────
log('Checking if already connected...');
if (quickDoctorCheck()) {
  log('Already connected — nothing to do.');
  console.log(JSON.stringify({
    ok: true,
    status: 'already-connected',
    profile: profileName,
    extVersion,
  }));
  process.exit(0);
}

// ── Step 3: Anti-duplicate — check if browser already running ────────────────
const userDataDir = profilePath(profileName);
mkdirSync(userDataDir, { recursive: true });
const pidFile = join(userDataDir, 'launcher.pid');

if (existsSync(pidFile)) {
  const existingPid = parseInt(readFileSync(pidFile, 'utf8').trim(), 10);
  if (!isNaN(existingPid) && isProcessAlive(existingPid)) {
    log(`Browser already running (PID ${existingPid}). Not launching a second instance.`);
    log('If this is stale, delete: ' + pidFile);
    console.log(JSON.stringify({
      ok: true,
      status: 'already-running',
      pid: existingPid,
      profile: profileName,
    }));
    process.exit(0);
  }
  // Stale PID file — clean up
  log(`Stale PID file (PID ${existingPid} not running), proceeding with launch.`);
}

// ── Step 4: Get Chromium executable path ──────────────────────────────────────
log('Resolving Chromium executable path...');
let executablePath;
try {
  executablePath = await getChromiumExecutablePath();
} catch (e) {
  fail(`Could not get Chromium executable path: ${e.message}`);
}

if (!existsSync(executablePath)) {
  fail(`Chromium executable not found: ${executablePath}`);
}
log(`Chromium: ${executablePath}`);

// ── Step 5: Build launch args ─────────────────────────────────────────────────
const extDir = extensionPath();
const { args: launchArgs, loadExtensionUsed } = buildLaunchArgs({ extDir, userDataDir });
const allArgs = [`--user-data-dir=${userDataDir}`, ...launchArgs];
log(`Launch args: ${allArgs.join(' ')}`);

// ── Step 6: Spawn Chromium (detached) ─────────────────────────────────────────
log('Spawning Chromium (detached)...');
const child = spawn(executablePath, allArgs, {
  detached: true,
  stdio: 'ignore',
});
child.unref(); // Node exits; browser stays alive

// ── Step 7: Early-exit detection (2s) ────────────────────────────────────────
await new Promise(r => setTimeout(r, 2000));
if (child.exitCode !== null) {
  process.stderr.write(
    `[launch-browser] ERROR: Chromium exited immediately (code ${child.exitCode}).\n` +
    `  Executable: ${executablePath}\n` +
    `  Args: ${allArgs.join(' ')}\n`
  );
  process.exit(1);
}
log(`Chromium launched, PID: ${child.pid}`);

// ── Step 8: Write launcher.pid and launcher.json ──────────────────────────────
const launchedAt = new Date().toISOString();
writeFileSync(pidFile, String(child.pid));
writeFileSync(join(userDataDir, 'launcher.json'), JSON.stringify({
  pid: child.pid,
  extVersion,
  loadExtensionUsed,
  launchedAt,
}, null, 2));

// ── Step 9: Poll opencli doctor ───────────────────────────────────────────────
log(`Waiting up to ${waitSeconds}s for opencli doctor...`);
const connected = await pollDoctor(waitSeconds, extDir, userDataDir, child.pid, loadExtensionUsed);

if (!connected) {
  process.exit(1);
}

// ── Step 10 (optional): Profile naming ────────────────────────────────────────
// Managed externally via: opencli profile rename <id> <name>

// ── Done — Node exits, browser stays alive ────────────────────────────────────
console.log(JSON.stringify({
  ok: true,
  status: 'launched',
  pid: child.pid,
  profile: profileName,
  userDataDir,
  extVersion,
  loadExtensionUsed,
  launchedAt,
}));

log('Node exiting — browser continues to run independently.');
