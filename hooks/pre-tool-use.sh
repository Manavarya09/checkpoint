#!/usr/bin/env bash
set -euo pipefail

# Checkpoint PreToolUse hook
# Snapshots files BEFORE Claude modifies them via Write or Edit tools
# This ensures we always have the pre-change state saved

SCRIPT_DIR="$(cd "$(dirname "$0")/../scripts" && pwd)"
INPUT=$(cat)

# Pass through unchanged
echo "$INPUT"

# Only act on Write and Edit tools
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name":"[^"]*"' | head -1 | cut -d'"' -f4 2>/dev/null || true)

if [ "$TOOL_NAME" != "Write" ] && [ "$TOOL_NAME" != "Edit" ] && [ "$TOOL_NAME" != "NotebookEdit" ]; then
  exit 0
fi

# Extract file path from the tool input
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | cut -d'"' -f4 2>/dev/null || true)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Track this file for checkpointing
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
PROJECT_ROOT="${PWD}"

export CLAUDE_SESSION_ID="$SESSION_ID"
export PROJECT_ROOT="$PROJECT_ROOT"

node "$SCRIPT_DIR/store.js" track "$FILE_PATH" 2>/dev/null || true
