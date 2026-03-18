#!/usr/bin/env bash
# Fires when Claude Code stops (finishes a response).
# Shows a macOS notification so you know Claude is done.

osascript -e 'display notification "Claude has finished." with title "ExamChecker — Claude Code" sound name "Glass"' 2>/dev/null || true
