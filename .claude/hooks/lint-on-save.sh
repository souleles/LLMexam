#!/usr/bin/env bash
# Fires after Claude edits or writes a file (PostToolUse on Edit/Write).
# Add your linting commands here.

FILE="$CLAUDE_TOOL_INPUT_FILE_PATH"

if [[ -z "$FILE" ]]; then
  exit 0
fi

# TypeScript/JavaScript (frontend or backend)
if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  cd "$(dirname "$FILE")" && npx eslint --fix "$FILE" 2>/dev/null || true
fi

# Python (python-service)
if [[ "$FILE" == *.py ]]; then
  python3 -m ruff check --fix "$FILE" 2>/dev/null || true
fi
