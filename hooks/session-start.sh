#!/usr/bin/env bash
set -euo pipefail

# Checkpoint SessionStart hook
# Creates the initial checkpoint (empty state) and announces the plugin

SCRIPT_DIR="$(cd "$(dirname "$0")/../scripts" && pwd)"

SESSION_ID="${CLAUDE_SESSION_ID:-default}"
PROJECT_ROOT="${PWD}"

export CLAUDE_SESSION_ID="$SESSION_ID"
export PROJECT_ROOT="$PROJECT_ROOT"

# Initialize session directory
node "$SCRIPT_DIR/store.js" create "session start" 2>/dev/null || true

echo "checkpoint: active. Use /checkpoint to list, /checkpoint undo to revert." >&2
