# checkpoint

Cursor-style checkpoint & undo for Claude Code.

Auto-snapshots your files before each prompt. Revert instantly — zero tokens, zero reimplementation.

## The Problem

You give Claude a prompt. It makes big changes across multiple files. You don't like the result. Now what?

- Asking Claude to "undo" burns tokens reimplementing
- Without git tracking, those changes might be gone
- Even with git, you'd need to manually figure out what changed

## The Solution

**checkpoint** automatically saves file snapshots before each prompt. One command to undo.

## Install

```bash
git clone https://github.com/Manavarya09/checkpoint.git ~/.claude/plugins/checkpoint
cd ~/.claude/plugins/checkpoint && bash install.sh
```

Restart Claude Code after installing.

## Commands

| Command | Action |
|---|---|
| `/checkpoint` | List all checkpoints |
| `/checkpoint undo` | Undo last prompt's changes |
| `/checkpoint undo N` | Undo to checkpoint N |
| `/checkpoint diff N` | See what changed since checkpoint N |
| `/checkpoint status` | Show stats (checkpoints, storage) |
| `/checkpoint clean` | Remove all checkpoint data |

## How It Works

```
You: "Add authentication to the login page"

  checkpoint: [auto-snapshot of tracked files] ← checkpoint #3

Claude: [modifies 5 files, creates 2 new files]

You: "I don't like this, undo"

  checkpoint: [restores all 5 files, deletes 2 new files] ← instant, 0 tokens
```

1. **SessionStart** — initializes checkpoint session
2. **Before each prompt** — snapshots all files Claude has previously modified
3. **Before each Write/Edit** — registers the target file for tracking
4. **Undo** — copies snapshot files back, deletes newly created files
5. **Safety net** — every undo creates its own checkpoint (undo the undo)

## Storage

- Checkpoints stored in `~/.claude-checkpoints/<session-id>/`
- Only files Claude modifies are tracked (not the entire project)
- Cleaned up when session ends or via `/checkpoint clean`
- Works with or without git — completely independent

## Uninstall

```bash
cd ~/.claude/plugins/checkpoint && bash uninstall.sh
```

## License

MIT
