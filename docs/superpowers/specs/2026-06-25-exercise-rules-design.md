# Exercise Rules — Design

## Problem

Professors currently have no way to give standing instructions to the LLM ("all variable names must be in English", "use snake_case for SQL identifiers", etc.) that apply across both checkpoint generation and pattern/regex generation. Today the only channel is the free-form chat `message`, which is ephemeral per-turn and not reusable.

This feature adds a persistent, editable list of teacher-authored "rules" per exercise, which is injected into both the checkpoint-generation and pattern-generation LLM prompts on every call.

Scope: `EXERCISE`-type exercises only (rules card hidden for `PROJECT`, consistent with `CheckpointsCard` and chat tabs already being hidden for projects).

## Data Model

New `Rule` model, FK to `Exercise` with cascade delete, following the existing `Conversation` model pattern:

```prisma
model Rule {
  id         String   @id @default(uuid())
  exerciseId String
  content    String
  order      Int
  createdAt  DateTime @default(now())
  exercise   Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)

  @@index([exerciseId])
  @@map("rules")
}
```

`Exercise` gains a `rules: Rule[]` relation field.

`order` is set from array index at save time and used only to preserve display order on reload — no manual reordering UI.

## Backend API (`backend/src/rules/`)

New `RulesModule`, mirroring the structure of `CheckpointsModule` (controller + service + DTO).

- `GET /rules?exerciseId=:id` — returns rules for an exercise, ordered by `order` ascending.
- `PUT /rules/:exerciseId` — body `{ rules: string[] }`. Replaces the full rule set for the exercise in a single transaction: delete all existing `Rule` rows for `exerciseId`, then create new rows from the array (empty strings filtered out), setting `order` from index. Returns the new list.

A full-replace endpoint is used instead of incremental add/delete endpoints because the frontend stages all changes locally and syncs once on Save — there's no need for the backend to support partial mutations.

DTO: `ReplaceRulesDto { rules: string[] }`, validated with `@IsArray()`, `@IsString({ each: true })`.

## Frontend

### `RulesCard.tsx` (`frontend/src/components/Exercise/RulesCard.tsx`)

New component, structurally modeled on `CheckpointsCard.tsx` (Card → CardBody → VStack → Heading/Divider/List).

- Heading: "Προσθήκη κανόνων"
- Helper text directly below heading: "Αυτοί οι κανόνες θα χρησιμοποιηθούν για την δημιουργία checkpoint και regex."
- Fetches existing rules via `GET /rules?exerciseId=:id` on mount (React Query), seeds local state `rules: string[]`.
- Each existing rule renders as an `Input` (editable) with a delete `IconButton` (✕) next to it.
- A trailing row: empty `Input` + "+" `IconButton` — typing text and clicking "+" (or pressing Enter) appends a new entry to local state and clears the input.
- All edits (add, delete, edit text) are local-only until "Αποθήκευση" button is clicked, which calls `PUT /rules/:exerciseId` with the current array. Button is disabled when local state matches the last-saved snapshot (no pending changes).
- On successful save, React Query cache is invalidated/updated with the response so local state and "saved" snapshot resync.

### `ExerciseDetailPage.tsx`

`RulesCard` rendered immediately below `CheckpointsCard`, gated by the same `!isProject` condition already used for `CheckpointsCard` and the chat tabs:

```tsx
{!isProject && <CheckpointsCard checkpoints={checkpoints} />}
{!isProject && <RulesCard exerciseId={exercise.id} />}
```

## LLM Prompt Integration

Rules are passed as a dedicated field, not merged into the teacher's live chat `message`, so they remain a stable "standing instructions" channel distinct from the conversational turn.

### NestJS (`llm.service.ts`)

Before calling `/generate-checkpoints` or `/generate-patterns`, fetch the exercise's rules (`prisma.rule.findMany({ where: { exerciseId }, orderBy: { order: 'asc' } })`) and add to both axios payloads:

```typescript
rules: rules.map((r) => r.content),
```

### Python service

`GenerateCheckpointsRequest` and `GeneratePatternsRequest` Pydantic models (in `python-service/models.py`) gain:

```python
rules: list[str] = []
```

In `checkpoint_prompts.py` and `patterns_prompts.py`, build the rules sentence only when non-empty:

```python
rules_text = f"Λάβε υπόψην του εξής κανόνες: {', '.join(rules)}" if rules else ""
```

This is interpolated into the user prompt template (`USER_PROMPT_INITIAL` for checkpoints, `USER_PROMPT_PATTERNS` for patterns) near the existing `{message}` placeholder, e.g. as a new `{rules_text}` placeholder on its own line. When `rules` is empty, the line is an empty string and contributes nothing to the prompt.

## Out of Scope

- Reordering rules via drag-and-drop (order is fixed by entry sequence).
- Per-rule timestamps/audit history.
- Rules for `PROJECT`-type exercises (no checkpoint/pattern generation exists for projects).
- Validating or linting rule text content.

## Testing

- Backend: unit test for `RulesService.replace()` covering delete+recreate transaction and empty-string filtering.
- Frontend: component test for `RulesCard` covering add/delete/save-dirty-state behavior.
- Manual: verify rules appear in the actual prompt sent to OpenAI for both checkpoint and pattern generation (e.g. via logging or a python-service unit test asserting the formatted prompt string).
