# Prompts

LLM prompt templates used in ExamChecker.

## Index

| File | Purpose |
|------|---------|
| [checkpoint-extraction.md](checkpoint-extraction.md) | Two-pass prompts for extracting checkpoints from exercise PDFs |
| [code-review.md](code-review.md) | Standard Claude Code review prompt |
| [debug-session.md](debug-session.md) | Debug session starter prompt |

## Prompt Design Principles

- **Structured output** — all LLM responses that feed into the app return valid JSON
- **Two-pass extraction** — Pass 1 identifies tasks; Pass 2 generates patterns per task
- **Explicit constraints** — prompts specify `match_mode`, `check_type`, and pattern format
- **Conversation trimming** — runtime context = original extraction + current JSON + last N messages
