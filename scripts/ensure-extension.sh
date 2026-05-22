#!/usr/bin/env bash
# ensure-extension.sh — thin bash wrapper for ensure-extension.mjs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "${SCRIPT_DIR}/ensure-extension.mjs" "$@"
