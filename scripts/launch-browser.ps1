# launch-browser.ps1 — thin PowerShell wrapper for launch-browser.mjs
# Sets PLAYWRIGHT_BROWSERS_PATH and delegates to Node.

param(
    [string]$Profile = "opencli",
    [int]$WaitSeconds = 30,
    [switch]$Secure,
    [switch]$OptimizeExtensionArgs
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $env:USERPROFILE ".opencli\playwright-browsers"

$nodeArgs = @(
    (Join-Path $scriptDir "launch-browser.mjs"),
    "--profile", $Profile,
    "--wait-seconds", $WaitSeconds
)
if ($Secure) { $nodeArgs += "--secure" }
if ($OptimizeExtensionArgs) { $nodeArgs += "--optimize-extension-args" }

node @nodeArgs @args
exit $LASTEXITCODE
