#!/usr/bin/env bash
set -euo pipefail

# Checkpoint UserPromptSubmit hook
# Creates a checkpoint BEFORE each new user prompt is processed
# This captures the state of all tracked files before Claude makes changes

SCRIPT_DIR="$(cd "$(dirname "$0")/../scripts" && pwd)"
INPUT=$(cat)

# Pass through unchanged
echo "$INPUT"

SESSION_ID="${CLAUDE_SESSION_ID:-default}"
PROJECT_ROOT="${PWD}"

export CLAUDE_SESSION_ID="$SESSION_ID"
export PROJECT_ROOT="$PROJECT_ROOT"

# Extract first 100 chars of user prompt for checkpoint label
PROMPT_PREVIEW=$(echo "$INPUT" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4 | head -c 100 2>/dev/null || echo "user prompt")

node "$SCRIPT_DIR/store.js" create "$PROMPT_PREVIEW" 2>/dev/null || true
