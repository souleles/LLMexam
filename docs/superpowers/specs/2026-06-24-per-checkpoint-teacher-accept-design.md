# Per-Checkpoint Teacher Accept/Reject — Design

## Problem

`teacherScore` is currently set via a modal where the professor manually types a single number (0–total checkpoints). This is disconnected from the actual checkpoint results shown in the accordion, and is easy to get wrong since the professor isn't reviewing each checkpoint individually.

## Goal

The professor decides accept/reject per checkpoint, inline in the existing `GradingAccordion`. `teacherScore` becomes derived from those decisions instead of being typed in manually. The "Επεξεργασία/Προσθήκη Βαθμού" button and modal are removed since they no longer serve a purpose.

## Data Model

Add a nullable boolean to `CheckpointResult`:

```prisma
model CheckpointResult {
  ...
  teacherAccepted Boolean? // null = not yet reviewed by teacher
}
```

`GradingResult.teacherScore` (existing `Float?`) becomes a derived value: count of `checkpointResults` with `teacherAccepted === true` for that grading result. It is recomputed and persisted every time a checkpoint's `teacherAccepted` changes. It stays `null` until the first checkpoint is reviewed (per user decision: the "Βαθμός Καθηγητή" summary card stays hidden until then, matching its current `!= null` rendering check).

## Backend Changes

- **Migration**: add nullable `teacherAccepted Boolean?` column to `checkpoint_results`. No backfill needed.
- **`grading.dto.ts`**: add `teacherAccepted?: boolean | null` to `CheckpointResultDto`. Remove `UpdateTeacherScoreDto` (no longer used).
- **`grading.service.ts`**:
  - Remove `updateTeacherScore`.
  - Add `updateCheckpointTeacherAccepted(checkpointResultId: string, teacherAccepted: boolean): Promise<GradingResultResponseDto>`:
    1. Update the `CheckpointResult.teacherAccepted`.
    2. Reload all `checkpointResults` for the parent `gradingResultId`.
    3. Compute `teacherScore = checkpointResults.filter(cr => cr.teacherAccepted === true).length`.
    4. Update `GradingResult.teacherScore`.
    5. Return the mapped `GradingResultResponseDto` (reuse `mapToResponseDto`).
  - `getAllResults` / `mapToResponseDto`: include `teacherAccepted` on each returned checkpoint result.
- **`grading.controller.ts`**: replace the `PATCH /grading/submission/:submissionId/teacher-score` route with `PATCH /grading/checkpoint-result/:id/teacher-accepted`, body `{ teacherAccepted: boolean }`.
- **`submissions.service.ts`** `findOne()`: include `teacherAccepted: cr.teacherAccepted` in the mapped `checkpointResults`.

## Frontend Changes

- **`lib/api.ts`**:
  - `Submission.gradingResult.checkpointResults[]` gains `teacherAccepted?: boolean | null`.
  - Replace `updateTeacherScore(submissionId, teacherScore)` with `updateCheckpointTeacherAccepted(checkpointResultId, teacherAccepted)` calling the new PATCH route.
- **`hooks/use-save-teacher-score.ts`** → replaced by `hooks/use-update-checkpoint-teacher-accepted.ts` (same shape: wraps the mutation, invalidates the submission query on success).
- **`lib/helpers.ts`** `mapCheckpointResultsToAccordionItems`: pass through `checkpointResultId: cr.id` and `teacherAccepted: cr.teacherAccepted` into each `CheckpointAccordionItem`.
- **`components/GradingAccordion/index.tsx`**:
  - `CheckpointAccordionItem` gains `checkpointResultId: string` and `teacherAccepted?: boolean | null`.
  - `GradingAccordionProps` gains an optional `onTeacherAcceptedChange?: (checkpointResultId: string, value: boolean) => void`.
  - Each `AccordionButton` row gets two small icon buttons (accept/reject) reflecting the 3-state value (undecided / accepted / rejected) — clicking calls `onTeacherAcceptedChange`. Use `stopPropagation` so clicking the buttons doesn't toggle the accordion panel.
- **`components/SubmissionDetail/index.tsx`**:
  - Remove: the "Επεξεργασία/Προσθήκη Βαθμού" `Button`, the `Modal`/`ModalBody`/`ModalFooter` block, `scoreValue` state, `handleOpen`, `handleSave`, `existingScore`, `total`, the `useSaveTeacherScore` import, `useDisclosure` import (if no longer used elsewhere in the file), `FiEdit2` import.
  - Wire `GradingAccordion`'s new `onTeacherAcceptedChange` to the new mutation hook, passing `submission.id` context for query invalidation.
  - The "Βαθμός Καθηγητή" summary card block is unchanged (still gated on `teacherScore != null`).

## Out of Scope

- No change to how `llmScore`/`score` (regex) are computed.
- No bulk accept/reject-all control — strictly per-checkpoint, per the existing accordion granularity.
- CSV/mini-report consumers of `teacherScore` (`students.service.ts`) need no changes — they already just read the stored `Float?`.
