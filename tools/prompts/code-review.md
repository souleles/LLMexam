# Prompt: Code Review

Standard prompt for asking Claude to review a file or change in this project.

## Usage

Paste the prompt below (filling in the blanks) when you want a structured code review.

---

## Prompt Template

```
Review the following code for the ExamChecker project.

Context:
- Service: [frontend | backend | python-service]
- File: [file path]
- Change type: [new feature | bug fix | refactor | other]
- Summary of change: [1-2 sentences]

Focus areas (check all that apply):
- [ ] Correctness — does the logic do what it claims?
- [ ] Type safety — TypeScript types correct? Python type hints accurate?
- [ ] Security — input validation, SQL injection, path traversal, secrets exposure
- [ ] Performance — unnecessary DB queries, N+1 patterns, missing indexes
- [ ] Error handling — unhandled exceptions, missing validation responses
- [ ] Consistency — does this match existing patterns in the codebase?

Code:
\`\`\`[language]
[paste code here]
\`\`\`

Return findings as a numbered list. For each finding include:
1. Severity: [Critical | High | Medium | Low | Nit]
2. Location: [line or function]
3. Issue: what is wrong
4. Fix: what to do instead
```

---

## Quick Review (for small changes)

```
Quick review of this [TypeScript/Python] code for ExamChecker [backend/frontend/python-service].
Check for: correctness, security, and consistency with NestJS/FastAPI patterns.

[paste code]
```
