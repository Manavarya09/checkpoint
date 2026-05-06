**Subreddit:** r/ClaudeAI (or r/ChatGPTCoding / r/LocalLLaMA)

**Title:** I built a checkpoint/undo plugin for Claude Code because reverting bad changes was killing my tokens

---

So this has been annoying me for a while. You know how in Cursor you can just hit "undo" and go back to before a prompt messed things up? Claude Code doesn't have that.

What happens instead: you give Claude a prompt, it makes sweeping changes across 5+ files, you realize you hate it, and now you're stuck. You either:

1. Ask Claude to "revert everything" (which burns a ton of tokens and half the time it doesn't get it right anyway)
2. Hope you had git commits at the right point
3. Manually undo things from memory

I kept running into this especially with big refactors. Claude would go ham on a "convert to TypeScript" prompt and touch every file. If I didn't like the approach, getting back to where I was before was painful.

So I made **checkpoint** — a Claude Code plugin that auto-snapshots your files before each prompt. When you want to go back, you just type `/checkpoint undo` and it restores everything instantly. No tokens wasted, no reimplementation, just file copies.

**How it works:**
- Hooks into Claude Code's lifecycle (PreToolUse + UserPromptSubmit)
- Before each prompt, it snapshots every file Claude has previously touched
- Before each Write/Edit, it registers that file for tracking
- Undo = copy the snapshots back + delete any files Claude created
- Every undo gets its own safety checkpoint (so you can undo the undo lol)

**It only tracks files Claude modifies** — not your whole project. So storage is basically nothing. My typical session uses like 0.01 MB of checkpoint data.

The best part honestly is that it just works in the background. You don't think about it until you need it, and then it's one command.

Commands:
```
/checkpoint          — list all checkpoints  
/checkpoint undo     — undo last prompt  
/checkpoint undo 3   — go back to checkpoint 3  
/checkpoint diff 3   — see what changed since then  
/checkpoint status   — how many checkpoints, storage used  
```

**Install:**
```
git clone https://github.com/Manavarya09/checkpoint.git ~/.claude/plugins/checkpoint
cd ~/.claude/plugins/checkpoint && bash install.sh
```

Zero dependencies, just Node.js. Works with or without git.

GitHub: https://github.com/Manavarya09/checkpoint

Would love feedback if anyone tries it. First time building a Claude Code plugin so there might be edge cases I haven't hit yet.
