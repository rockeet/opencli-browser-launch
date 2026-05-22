#!/usr/bin/env bash
# launch-browser.sh — thin bash wrapper for launch-browser.mjs
# Sets PLAYWRIGHT_BROWSERS_PATH and delegates to Node.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PLAYWRIGHT_BROWSERS_PATH="${HOME}/.opencli/playwright-browsers"

exec node "${SCRIPT_DIR}/launch-browser.mjs" "$@"
