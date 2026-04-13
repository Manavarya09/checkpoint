---
name: checkpoint
description: "Cursor-style checkpoint & undo for Claude Code. Instantly revert to any previous state. Trigger: '/checkpoint', '/cp', 'undo changes', 'revert changes', 'go back to before', 'restore previous version', 'undo last prompt'."
argument-hint: "[list|undo|undo N|diff N|status|clean]"
allowed-tools: Bash, Read, Write
---

# checkpoint — Instant Undo for Claude Code

Auto-snapshots your files before each prompt. Revert instantly — no tokens wasted, no reimplementation.

## Commands

### `/checkpoint` or `/cp` — List all checkpoints
```bash
CLAUDE_SESSION_ID="${CLAUDE_SESSION_ID}" PROJECT_ROOT="${PWD}" node "${CLAUDE_SKILL_DIR}/../../scripts/store.js" list
```

Display the result as a formatted table:
```
#  | Time       | Files | Preview
---|------------|-------|--------
1  | 14:23:01   | 0     | session start
2  | 14:23:45   | 3     | Add auth to login page...
3  | 14:25:12   | 5     | Refactor the header comp...
```

### `/checkpoint undo` or `/cp undo` — Undo last prompt's changes
```bash
CLAUDE_SESSION_ID="${CLAUDE_SESSION_ID}" PROJECT_ROOT="${PWD}" node "${CLAUDE_SKILL_DIR}/../../scripts/store.js" undo
```

This restores all files to their state at the most recent checkpoint (before the last prompt ran). Files created by the last prompt are deleted. A safety checkpoint is auto-created first so the undo itself can be undone.

Display result: "Restored to checkpoint #N. X files restored, Y new files removed."

### `/checkpoint undo N` or `/cp undo N` — Undo to specific checkpoint
```bash
CLAUDE_SESSION_ID="${CLAUDE_SESSION_ID}" PROJECT_ROOT="${PWD}" node "${CLAUDE_SKILL_DIR}/../../scripts/store.js" restore N
```

Replace N with the checkpoint number. Restores all tracked files to their state at checkpoint N. All files created after checkpoint N are deleted.

Display result: "Restored to checkpoint #N. X files restored, Y new files removed."

### `/checkpoint diff N` or `/cp diff N` — See what changed since checkpoint N
```bash
CLAUDE_SESSION_ID="${CLAUDE_SESSION_ID}" PROJECT_ROOT="${PWD}" node "${CLAUDE_SKILL_DIR}/../../scripts/store.js" diff N
```

Shows which files differ between checkpoint N and the current state, with line count changes.

### `/checkpoint status` or `/cp status` — Show checkpoint stats
```bash
CLAUDE_SESSION_ID="${CLAUDE_SESSION_ID}" PROJECT_ROOT="${PWD}" node "${CLAUDE_SKILL_DIR}/../../scripts/store.js" status
```

Shows: session ID, number of checkpoints, tracked files count, storage used.

### `/checkpoint clean` or `/cp clean` — Clean up all checkpoints
```bash
CLAUDE_SESSION_ID="${CLAUDE_SESSION_ID}" PROJECT_ROOT="${PWD}" node "${CLAUDE_SKILL_DIR}/../../scripts/store.js" cleanup
```

Removes all checkpoint data for the current session.

## Natural Language Triggers

When the user says things like:
- "undo that" / "revert that" / "go back" → run `/checkpoint undo`
- "undo to before the auth changes" → list checkpoints, find the right one, run `/checkpoint undo N`
- "what did you change?" → run `/checkpoint diff` with the last checkpoint
- "I don't like these changes" → run `/checkpoint undo`

## How It Works

1. **SessionStart hook** initializes the checkpoint session
2. **UserPromptSubmit hook** creates a checkpoint before each prompt (snapshots all tracked files)
3. **PreToolUse hook** watches Write/Edit calls and registers target files for tracking
4. **Undo** = copy snapshot files back + delete newly created files
5. Every undo creates a safety checkpoint first (so you can undo the undo)

## Important Notes

- Checkpoints only track files Claude modifies — not the entire project
- Storage is in `~/.claude-checkpoints/<session-id>/`
- Checkpoints persist for the session lifetime
- Works with or without git — completely independent
- Zero token cost to undo — it's just file copies
