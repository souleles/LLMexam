# Explain Failed Regex Checkpoints with LLM — Design

## Purpose

When a submission has been regex-graded and at least one checkpoint failed, the professor can trigger an LLM call that explains, in Greek, why each failed checkpoint did not match — either because the required code is entirely absent, or because it exists but is written differently than the regex pattern expects.

Applies only to `EXERCISE`-type submissions that have a regex grading result with at least one failed checkpoint. `PROJECT`-type exercises have no regex grading and are out of scope.

## Database

Add a nullable column to `CheckpointResult`:

```prisma
model CheckpointResult {
  ...
  regexFailureExplanation String?
}
```

- Written only by the new explain flow; untouched by regular regex/LLM (re)grading.
- Overwritten every time the explain endpoint is called again for that checkpoint (always regenerates, no caching/skip logic).
- Created via a new Prisma migration.

## Backend (NestJS)

New endpoint on `SubmissionsController`:

```
POST /api/submissions/:id/explain-regex-failures
```

Behavior (in `SubmissionsService`, new method `explainRegexFailures(submissionId)`):

1. Load the submission (`content`, `exerciseId`).
2. Load the exercise with its checkpoints. If `exerciseType === 'PROJECT'`, throw `BadRequestException`.
3. Load the current `gradingResult` with `checkpointResults` (include `checkpoint`).
4. Filter to checkpoints where `checkpointResult.matched === false`. If none, throw `BadRequestException('No failed regex checkpoints to explain')`.
5. Parse the stored submission content back into files (`parseStoredContent`, already exists).
6. Call Python `POST /explain-regex-failures` with:
   ```json
   {
     "checkpoints": [{ "id", "description", "pattern", "case_sensitive" }, ...],
     "files": [{ "relative_path", "content" }, ...]
   }
   ```
7. For each `{ checkpoint_id, explanation }` in the response, update the matching `checkpointResult.regexFailureExplanation`.
8. Return `{ submissionId, explanations: [{ checkpointId, checkpointDescription, explanation }] }`.

This mirrors the existing `regradeSubmission` → `fetchGradeData` → persist pattern already used in this file; no new abstractions.

## Python microservice

New files, following the same shape as the existing `/grade-llm` path:

- **`models.py`** additions:
  ```python
  class ExplainFailureCheckpoint(BaseModel):
      id: str
      description: str
      pattern: str
      case_sensitive: bool = False

  class ExplainFailuresRequest(BaseModel):
      checkpoints: list[ExplainFailureCheckpoint]
      files: list[FileContent]  # reuse existing FileContent

  class CheckpointExplanation(BaseModel):
      checkpoint_id: str
      explanation: str

  class ExplainFailuresResponse(BaseModel):
      results: list[CheckpointExplanation]
  ```

- **`prompts/explain_failures_prompts.py`**: Greek system prompt. The model plays a university teacher reviewing a failed automatic check. For each checkpoint it receives: id, description, regex pattern (for context only — not authoritative), and the annotated submission code. It must decide, per checkpoint:
  - the required code is **missing entirely**, or
  - the code **exists but differs** from what the pattern expects (state briefly how — different keyword, syntax, casing, structure, etc.)

  Output: strict JSON `{ "results": [{ "checkpoint_id": "...", "explanation": "<one Greek sentence>" }, ...] }` — exactly one sentence per checkpoint, no markdown, no preamble.

- **`services/explain_failures_service.py`**: `explain_regex_failures(request: ExplainFailuresRequest) -> ExplainFailuresResponse`. Reuses the file-annotation/chunking helpers already in `llm_grading_service.py` (import them rather than duplicating). Uses:
  ```python
  ChatOpenAI(model="gpt-4o-mini", temperature=0.2, model_kwargs={"response_format": {"type": "json_object"}})
  ```
  `gpt-4o-mini` is appropriate here: the task is explaining already-known failures (not discovering matches across a whole submission), so the lighter/cheaper model is sufficient — consistent with using a stronger model (`gpt-4o`) only where match-discovery accuracy matters.

  Same chunking behavior as LLM grading for large submissions: if a checkpoint's evidence spans multiple chunks, concatenate any non-empty explanation found (first non-trivial one wins, since the explanation should be the same regardless of chunk).

- **`main.py`**: new route `POST /explain-regex-failures`, delegates to the service, matches existing route style.

## Frontend

- **`hooks/use-explain-regex-failures.ts`**: new mutation hook, mirrors `use-regrade-submission.ts`, calls `api.submissions.explainRegexFailures(submissionId)`.
- **`lib/api.ts`**: add `submissions.explainRegexFailures(submissionId): Promise<{ submissionId, explanations: Array<{checkpointId, checkpointDescription, explanation}> }>` and extend the `Submission.gradingResult.checkpointResults[]` type with optional `regexFailureExplanation?: string | null`.
- **`SubmissionDetail`**:
  - New button **"Αιτιολόγηση Αποτυχημένων Regex"**, placed in the same `HStack` as the Regex/LLM regrade buttons.
  - Enabled only when `!isProject` and at least one `checkpointResult.matched === false` exists in the current grading result.
  - On click: calls the mutation; on success, opens a `Modal` listing each failed checkpoint's description + LLM-generated explanation sentence; invalidates the submission query so the persisted explanations are reflected on reload.
  - If `checkpointResults` already contain `regexFailureExplanation` values (e.g. after a page reload, before re-triggering), a secondary lightweight link **"Προβολή Αιτιολογήσεων"** opens the same modal directly from already-loaded data, without calling the API again.

## Out of scope

- PROJECT-type exercises (no regex grading exists for them).
- Caching/skip-if-exists logic — every click regenerates and overwrites.
- Editing/overriding the LLM explanation text manually.
