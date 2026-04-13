#!/usr/bin/env bash
set -euo pipefail

# Checkpoint plugin installer
# Wires hooks into Claude Code settings.json

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
SETTINGS_FILE="$HOME/.claude/settings.json"

echo "Installing checkpoint plugin..."
echo "Plugin dir: $PLUGIN_DIR"

# Ensure settings file exists
if [ ! -f "$SETTINGS_FILE" ]; then
  mkdir -p "$(dirname "$SETTINGS_FILE")"
  echo '{}' > "$SETTINGS_FILE"
fi

# Use node to safely merge hooks into settings.json
node -e "
import { readFileSync, writeFileSync } from 'fs';

const settingsPath = '$SETTINGS_FILE';
const pluginDir = '$PLUGIN_DIR';

let settings;
try {
  settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
} catch {
  settings = {};
}

if (!settings.hooks) settings.hooks = {};

const hookConfigs = {
  SessionStart: {
    hooks: [{ type: 'command', command: 'bash ' + pluginDir + '/hooks/session-start.sh' }]
  },
  PreToolUse: {
    hooks: [{ type: 'command', command: 'bash ' + pluginDir + '/hooks/pre-tool-use.sh' }]
  },
  UserPromptSubmit: {
    hooks: [{ type: 'command', command: 'bash ' + pluginDir + '/hooks/prompt-submit.sh' }]
  }
};

for (const [event, config] of Object.entries(hookConfigs)) {
  if (!settings.hooks[event]) settings.hooks[event] = [];

  // Check if checkpoint hook already installed
  const existing = settings.hooks[event].find(h =>
    h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('checkpoint'))
  );

  if (!existing) {
    settings.hooks[event].push(config);
    console.log('  + Added ' + event + ' hook');
  } else {
    console.log('  ~ ' + event + ' hook already installed');
  }
}

writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log('');
console.log('Hooks installed to: ' + settingsPath);
" --input-type=module

echo ""
echo "checkpoint installed. Restart Claude Code to activate."
echo ""
echo "Commands:"
echo "  /checkpoint        — list all checkpoints"
echo "  /checkpoint undo   — undo last prompt's changes"
echo "  /checkpoint undo N — undo to checkpoint N"
echo "  /checkpoint diff N — see changes since checkpoint N"
echo "  /checkpoint status — show stats"
echo "  /checkpoint clean  — remove all checkpoints"
