# ADR-0002: Grading Strategy — Deterministic Regex + Optional LLM Semantic

**Date:** 2026-03-19
**Amended:** 2026-05-05
**Status:** Amended
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

## Original Decision (2026-03-19)

The LLM would be used **only once per exercise**, during setup, to extract structured
checkpoints. All grading (Phase 3) would be **fully deterministic** regex matching in NestJS.

---

## Amendment (2026-05-05)

The implementation evolved to support **two parallel grading methods**:

### Method A: Deterministic Regex Grading (primary, original design)

Grading is handled by the Python microservice (`grading_service.py`), not NestJS:

1. For each checkpoint, compile `re.compile(pattern, flags)` (case-insensitive by default)
2. For `.sql` files, split into logical blocks (PROCEDURE / TRIGGER / FUNCTION / EVENT)
   to prevent greedy quantifiers from matching across unrelated procedures
3. Search each file; collect `{file, line_number, full_line_text}` for every match
4. Return `matched: true/false` + `matched_snippets[]`

Results are stored in `checkpoint_results.matched` + `checkpoint_results.matchedSnippets`.
The aggregate score (`grading_results.score`) is `(passedCheckpoints / totalCheckpoints) * 100`.

### Method B: LLM Semantic Grading (optional, added for research)

Handled by `llm_grading_service.py`:

1. Annotate submission files with line numbers (`"  42 | code line text"`)
2. Format each checkpoint as: `ID`, `Description`, `Regex hint`
3. Send to GPT-4o (via LangChain) requesting JSON output
4. LLM returns `{checkpoint_id, matched, matched_snippets}` for each checkpoint
5. Results stored separately: `checkpoint_results.llmMatched` + `llmMatchedSnippets`

The aggregate LLM score (`grading_results.llmScore`) is stored alongside the regex score.

### Coexistence

Both methods can be run on the same submission. The `grading_results` table stores:
- `score` / `passedCheckpoints` — from regex grading
- `llmScore` / `llmPassedCheckpoints` — from LLM grading
- `teacherScore` — optional professor override

This dual-result design supports the thesis research goal of **comparing deterministic
vs. semantic grading agreement** across a real dataset.

---

## Consequences

### Positive (regex method)
- Grading is reproducible: same input always produces same result
- Audit trail: professors see exactly which patterns matched/missed
- No per-student LLM cost — grading runs in seconds
- Defensible: professors can show students exactly what was checked

### Negative (regex method)
- Cannot detect semantically correct but differently structured answers
  (e.g., a subquery written as a CTE may not match a subquery pattern)
- Quality depends on checkpoint extraction quality in setup phase

### Positive (LLM method)
- Semantic understanding — detects equivalent code written in different styles
- More flexible for varied student solutions
- No complex regex authoring required

### Negative (LLM method)
- Non-deterministic — same submission may be graded differently on two runs
- Per-call LLM cost (GPT-4o API)
- Less transparent — harder to audit why a checkpoint passed or failed
- Not suitable as the sole grading method for official university assessment

### Neutral
- The LLM is used as a "checkpoint generation assistant" in setup AND as an optional
  "semantic checker" in grading — with different expectations for each role
- Pattern matching moved to Python (`grading_service.py`) to keep all grading logic in one place

## Alternatives Considered

| Alternative | Reason rejected |
|-------------|----------------|
| LLM grades only, no regex | Non-reproducible, expensive, opaque |
| Pure regex with no LLM at all | Professors must write regex manually — bad UX |
| Replace regex with LLM entirely | Loses reproducibility guarantee |
| LLM grading in NestJS | Better in Python alongside regex grading and PDF handling |

## References

- `docs/architecture.md` — Phase 3 sequence diagrams (both methods)
- `python-service/services/grading_service.py` — Regex grading implementation
- `python-service/services/llm_grading_service.py` — LLM grading implementation
- `docs/decisions/0003-python-microservice.md` — Why grading lives in Python
