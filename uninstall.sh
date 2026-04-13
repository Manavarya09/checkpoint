#!/usr/bin/env bash
set -euo pipefail

# Checkpoint plugin uninstaller
# Removes hooks from Claude Code settings.json

SETTINGS_FILE="$HOME/.claude/settings.json"

echo "Uninstalling checkpoint plugin..."

if [ ! -f "$SETTINGS_FILE" ]; then
  echo "No settings file found. Nothing to uninstall."
  exit 0
fi

node -e "
import { readFileSync, writeFileSync } from 'fs';

const settingsPath = '$SETTINGS_FILE';
let settings = JSON.parse(readFileSync(settingsPath, 'utf8'));

if (!settings.hooks) { console.log('No hooks found.'); process.exit(0); }

let removed = 0;
for (const event of Object.keys(settings.hooks)) {
  const before = settings.hooks[event].length;
  settings.hooks[event] = settings.hooks[event].filter(h =>
    !(h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('checkpoint')))
  );
  const diff = before - settings.hooks[event].length;
  if (diff > 0) {
    console.log('  - Removed ' + event + ' hook');
    removed += diff;
  }
  if (settings.hooks[event].length === 0) delete settings.hooks[event];
}

if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log('Removed ' + removed + ' hooks.');
" --input-type=module

# Optionally clean up checkpoint data
echo ""
read -p "Remove all checkpoint data (~/.claude-checkpoints)? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf "$HOME/.claude-checkpoints"
  echo "Checkpoint data removed."
fi

echo "checkpoint uninstalled."
