# ADR-0002: Grading Strategy — Deterministic Regex + Optional LLM Semantic

**Date:** 2026-03-19
**Amended:** 2026-05-05, 2026-05-10
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

### Method C: LLM Question Discovery for Projects (added 2026-05-10)

Handled by `project_grading_service.py` via `/grade-project-llm`. Applies **only** to `PROJECT`-type exercises, which have no pre-defined checkpoints.

1. NestJS sends `exercise_text` (extracted from the exercise PDF) + annotated student `files[]`
2. GPT-4o **discovers** the questions/requirements present in the exercise text — no human-authored checkpoints required
3. LLM evaluates the student submission against each discovered question in one pass
4. Returns `{question_id ("Q1", "Q2", …), description, matched, matched_snippets[]}`
5. NestJS creates `Checkpoint` records for each discovered question (description filled; pattern empty)
6. Results stored in `llmMatched` / `llmMatchedSnippets` (same fields as Method B)
7. Aggregate stored in `llmScore` / `llmPassedCheckpoints`

Re-grading a project after the first run uses Method B (standard `/grade-llm`) with the now-existing checkpoints — no re-discovery.

### Coexistence

Methods A and B can be run on the same EXERCISE submission. Method C is exclusive to PROJECT submissions (which never use regex grading). The `grading_results` table stores all three side-by-side:
- `score` / `passedCheckpoints` — from Method A (regex)
- `llmScore` / `llmPassedCheckpoints` — from Method B (LLM semantic) or Method C (project discovery)
- `teacherScore` — optional professor override

This design supports the thesis research goal of **comparing deterministic vs. semantic grading agreement** across a real dataset, and extends to open-ended project evaluation.

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

### Positive (LLM semantic method)
- Semantic understanding — detects equivalent code written in different styles
- More flexible for varied student solutions
- No complex regex authoring required

### Negative (LLM semantic method)
- Non-deterministic — same submission may be graded differently on two runs
- Per-call LLM cost (GPT-4o API)
- Less transparent — harder to audit why a checkpoint passed or failed
- Not suitable as the sole grading method for official university assessment

### Positive (project discovery method)
- Eliminates checkpoint authoring entirely — suitable for open-ended projects
- Single LLM call discovers questions and evaluates the submission simultaneously
- Naturally handles projects where requirements are embedded in prose, not bullet points

### Negative (project discovery method)
- Question discovery is LLM-dependent — if the exercise PDF is poorly structured the LLM may miss or misinterpret questions
- No regex fallback — projects are LLM-only
- Re-grading uses discovered questions verbatim; re-discovery on a re-grade could yield different questions

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
| Re-discover questions on every project re-grade | Different runs could produce different question sets, making score comparison meaningless; first-run questions are persisted as checkpoints instead |

## References

- `docs/architecture.md` — Phase 3 sequence diagrams (all methods including project discovery)
- `python-service/services/grading_service.py` — Method A: regex grading
- `python-service/services/llm_grading_service.py` — Method B: LLM semantic grading
- `python-service/services/project_grading_service.py` — Method C: project question discovery + grading
- `python-service/prompts/project_grading_prompts.py` — GPT-4o prompts for question discovery
- `docs/decisions/0003-python-microservice.md` — Why grading lives in Python
