# publish-to-github.ps1
# Publish opencli-browser-launch skill to GitHub.
#
# Workflow (uses this skill end-to-end):
#   1. launch-browser.ps1  — bootstrap Chromium + Browser Bridge extension
#   2. opencli browser open — smoke-test GitHub access via browser
#   3. git init + gh repo create + push
#   4. opencli browser open — confirm repo page
#
# Usage:
#   .\publish-to-github.ps1
#   .\publish-to-github.ps1 -RepoOwner rockeet -RepoName opencli-browser-launch -Public
#   .\publish-to-github.ps1 -SkipLaunch -SkipBrowserTest   # re-push only

param(
    [string]$RepoOwner = "rockeet",
    [string]$RepoName  = "opencli-browser-launch",
    [switch]$Public,
    [switch]$SkipLaunch,
    [switch]$SkipBrowserTest,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$SkillRoot = Split-Path -Parent $PSScriptRoot
$ScriptsDir = $PSScriptRoot
$RepoFull = "$RepoOwner/$RepoName"
$RepoUrl  = "https://github.com/$RepoFull"
$sessionName = "publish-$RepoName"

function Write-Step([string]$Msg) {
    Write-Host "`n==> $Msg" -ForegroundColor Cyan
}

function Assert-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

# Run native commands without treating stderr as terminating errors (PowerShell 5.x)
function Invoke-External {
    param([scriptblock]$Command)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $Command 2>&1 | ForEach-Object { Write-Host $_ }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    return $code
}

# ── Preflight ────────────────────────────────────────────────────────────────
Write-Step "Preflight checks"
Assert-Command node
Assert-Command pnpm
Assert-Command opencli
Assert-Command git
Assert-Command gh

$ghUser = gh api user --jq .login 2>&1
if ($LASTEXITCODE -ne 0) { throw "gh not authenticated. Run: gh auth login" }
Write-Host "  gh user: $ghUser"
Write-Host "  skill root: $SkillRoot"
Write-Host "  target repo: $RepoFull"

# ── Step 1: Launch browser via this skill ────────────────────────────────────
if (-not $SkipLaunch) {
    Write-Step "Step 1 — launch browser (opencli-browser-launch)"
    & "$ScriptsDir\launch-browser.ps1" -Profile opencli -WaitSeconds 30
    if ($LASTEXITCODE -ne 0) { throw "launch-browser.ps1 failed (exit $LASTEXITCODE)" }
} else {
    Write-Step "Step 1 — skipped (-SkipLaunch)"
}

Write-Step "Verify opencli doctor"
opencli doctor
if ($LASTEXITCODE -ne 0) { throw "opencli doctor failed — daemon or extension not connected" }

# ── Step 2: Smoke-test GitHub via opencli browser ────────────────────────────
if (-not $SkipBrowserTest) {
    Write-Step "Step 2 — smoke test GitHub via opencli browser"
    $smokeOk = $false
    for ($i = 1; $i -le 3; $i++) {
        opencli browser $sessionName open "https://github.com/$RepoOwner" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $smokeOk = $true; break }
        Write-Host "  Attempt $i failed, retrying..."
        Start-Sleep -Seconds 2
    }
    if (-not $smokeOk) { throw "opencli browser failed to open GitHub after 3 attempts" }
    opencli browser $sessionName state 2>&1 | Select-Object -First 10
    Write-Host "  GitHub access via browser: OK"
} else {
    Write-Step "Step 2 — skipped (-SkipBrowserTest)"
}

# ── Step 3: Git init + commit ────────────────────────────────────────────────
Write-Step "Step 3 — git init and commit"
Set-Location $SkillRoot

if (-not (Test-Path ".git")) {
    git init
    if ($LASTEXITCODE -ne 0) { throw "git init failed" }
}

git add -A
$status = git status --porcelain
if (-not $status) {
    Write-Host "  Nothing to commit — working tree clean"
} else {
    git commit -m "Update opencli-browser-launch skill"
    if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
}

# ── Step 4: Create GitHub repo and push ──────────────────────────────────────
Write-Step "Step 4 — create GitHub repo and push"

$prevEa = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$null = gh repo view $RepoFull 2>&1
$repoExistsCode = $LASTEXITCODE
$ErrorActionPreference = $prevEa

if ($repoExistsCode -ne 0) {
    $visFlag = if ($Public) { "--public" } else { "--private" }
    Write-Host "  Creating repo $RepoFull ($visFlag) ..."
    if ($DryRun) {
        Write-Host "  [DRY RUN] gh repo create $RepoFull $visFlag --source=. --remote=origin --push"
    } else {
        gh repo create $RepoFull $visFlag --source=. --remote=origin --push --description "Cursor skill: bootstrap Chromium + OpenCLI Browser Bridge extension"
        if ($LASTEXITCODE -ne 0) { throw "gh repo create failed" }
    }
} else {
    Write-Host "  Repo $RepoFull already exists — pushing ..."
    if (-not (git remote get-url origin 2>$null)) {
        git remote add origin "git@github.com:$RepoFull.git"
    }
    if ($DryRun) {
        Write-Host "  [DRY RUN] git push -u origin HEAD"
    } else {
        git push -u origin HEAD
        if ($LASTEXITCODE -ne 0) { throw "git push failed" }
    }
}

# ── Step 5: Confirm repo page in browser ────────────────────────────────────
if (-not $DryRun) {
    Write-Step "Step 5 — confirm repo page in browser"
    opencli browser $sessionName open $RepoUrl 2>&1
    opencli browser $sessionName state 2>&1 | Select-Object -First 10
}

Write-Host "`nDone! Published to $RepoUrl" -ForegroundColor Green
Write-Host "Install as Cursor skill:"
Write-Host "  npx skills add $RepoFull --skill opencli-browser-launch"
