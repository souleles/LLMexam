# Prompt: Debug Session Starter

Use this prompt to start a structured debugging session with Claude.
It enforces the project's debugging guidelines: max 3 attempts per approach,
list root causes first, step back if stuck.

---

## Prompt Template

```
I need help debugging an issue in ExamChecker.

Service: [frontend | backend | python-service]
Symptom: [what is happening]
Expected: [what should happen]
When it occurs: [always | sometimes | after specific action]

Error message / stack trace:
\`\`\`
[paste error here]
\`\`\`

Relevant code:
\`\`\`[language]
[paste code here]
\`\`\`

Please:
1. List the top 3 most likely root causes and how to verify each
2. Create a numbered diagnostic plan (max 3 attempts per approach)
3. If an approach fails after 3 tries, move to the next one
4. Do NOT retry the same fix in a loop
```

---

## Service-Specific Debug Starters

### SSE Streaming Issues (NestJS ↔ Python ↔ Frontend)
```
The SSE stream is [not connecting | dropping | sending garbage].

Setup: React (EventSource) → NestJS (/llm/chat SSE endpoint) → Python (/generate-checkpoints SSE)

What I see: [describe]
Network tab shows: [describe request/response headers]
NestJS logs: [paste]
Python logs: [paste]
```

### Grading Mismatch (student answer not matching)
```
A checkpoint is not matching when it should (or matching when it shouldn't).

Checkpoint:
- description: [...]
- patterns: [...]
- match_mode: [any|all]
- check_type: [keyword|structural]

Student text (after preprocessing):
[paste]

Expected result: matched=true / matched=false
Actual result: [what happened]
```

### Database / ORM Issues
```
Database operation failing in [ExerciseModule | GradingModule | etc.].

Query attempted: [describe or paste]
Error: [paste]
Schema: [relevant table columns]
```
