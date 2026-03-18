# ADR-0002: LLM Only in Setup Phase — Deterministic Grading

**Date:** 2026-03-19
**Status:** Accepted
**Deciders:** Project author (thesis)

---

## Context

ExamChecker must grade student submissions. The naive approach would be to send each
student file to an LLM and ask "does this meet the requirements?". However, this creates
several problems:

- **Non-reproducibility:** LLM responses are non-deterministic — the same submission
  graded twice may get different results
- **Cost at scale:** Grading 50 students × 10 checkpoints = 500 LLM calls per exercise
- **Opacity:** Professors cannot audit why a student passed or failed a checkpoint
- **Latency:** LLM calls add significant wait time to batch grading
- **Trust:** University grading must be defensible and consistent

---

## Decision

The LLM is used **only once per exercise**, during the setup phase, to help the professor
extract structured checkpoints from the exercise PDF. This output is a JSON array of
checkpoint objects with explicit regex patterns, `match_mode`, and `check_type`.

All subsequent grading (Phase 3) is **fully deterministic**:
- `keyword` checkpoints use regex pattern matching against preprocessed student text
- `structural` checkpoints use `sqlparse` (Python) or AST parsing for structure analysis
- No LLM calls happen during grading

The professor reviews and approves the checkpoints before any grading runs.

---

## Consequences

### Positive
- Grading is reproducible: same input always produces same result
- Audit trail: professors can see exactly which patterns matched/missed
- No per-student LLM cost — grading is essentially free to run
- Fast: grading a batch is pure regex/parsing, runs in seconds
- Defensible: professors can show students exactly what was checked

### Negative
- Cannot detect "semantically correct but differently structured" answers
  (e.g., a subquery written as a CTE might not match a subquery pattern)
- Quality of grading depends on quality of checkpoint extraction in setup phase
- Professors must invest time in the setup phase to get good checkpoints

### Neutral
- The LLM is used as a "checkpoint generation assistant", not an "answer checker"
- Structural checks (`sqlparse`) add complexity to the Python microservice

## Alternatives Considered

| Alternative | Reason rejected |
|-------------|----------------|
| LLM grades each submission | Non-reproducible, expensive, opaque |
| Pure regex with no LLM at all | Professors would need to write regex manually — bad UX |
| LLM + regex hybrid in grading | Adds non-determinism back; harder to audit |

## References

- Product specification: Phase 3 section
- `tools/prompts/checkpoint-extraction.md` — the two-pass LLM prompts
