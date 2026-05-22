# ensure-extension.ps1 — thin PowerShell wrapper for ensure-extension.mjs
# Detects/downloads/extracts the Browser Bridge extension.

param(
    [switch]$Force,
    [string]$Version = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$nodeArgs = @((Join-Path $scriptDir "ensure-extension.mjs"))
if ($Force) { $nodeArgs += "--force" }
if ($Version) { $nodeArgs += "--version"; $nodeArgs += $Version }

node @nodeArgs @args
exit $LASTEXITCODE
