# Claude Code Hooks

Hooks are shell scripts that run automatically at specific Claude Code lifecycle events.
They are configured in `.claude/settings.json`.

## Available Hooks

### `notify-macos.sh`
**Trigger:** `Stop` (when Claude finishes a response)
**Purpose:** Shows a macOS system notification so you know Claude is done working.

### `lint-on-save.sh`
**Trigger:** `PostToolUse` on `Edit` or `Write` tools
**Purpose:** Runs linting after Claude edits a file. Currently a stub — add your linter commands inside.

## Adding a New Hook

1. Create a `.sh` file in this directory
2. Make it executable: `chmod +x .claude/hooks/your-hook.sh`
3. Register it in `.claude/settings.json` under the appropriate event key

## Hook Events Reference

| Event | When it fires |
|-------|--------------|
| `Stop` | Claude finishes responding |
| `PreToolUse` | Before any tool call |
| `PostToolUse` | After any tool call |
| `Notification` | When Claude sends a notification |
