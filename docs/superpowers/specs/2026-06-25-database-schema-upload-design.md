# Database Schema Upload — Design

## Summary

Add an optional "database schema" text field to exercises. On the exercise detail page, above the Rules card, a professor can upload a `.txt` file containing the database schema. The extracted text is stored on the exercise and can be viewed in a full-height modal. When present, it is injected into the **pattern-generation** LLM prompt (not the checkpoint-generation prompt).

## Data Model

`Exercise` (Prisma) gains one nullable column:

```prisma
model Exercise {
  ...
  databaseSchema String?
  ...
}
```

No new table — unlike `Rule` (a list), this is a single optional text blob per exercise, same shape as `extractedText`. Requires a new Prisma migration.

## Backend (NestJS — `ExercisesModule`)

New endpoints in `exercises.controller.ts`:

- `POST /exercises/:id/schema` — multipart upload (`FileInterceptor`, memory storage, no disk persistence needed). Accepts only `.txt` (reject other mimetypes/extensions with `BadRequestException`, mirroring the PDF check in `/exercises/upload`). Reads the buffer as UTF-8, calls `exercisesService.setSchema(id, text)`, returns the updated `ExerciseResponseDto`.
- `DELETE /exercises/:id/schema` — calls `exercisesService.setSchema(id, null)`, returns the updated `ExerciseResponseDto`.

`exercises.service.ts`: add `setSchema(id, databaseSchema: string | null)` using the existing `update()`-style Prisma call; reuse `mapToResponseDto`.

`exercise.dto.ts`: `ExerciseResponseDto` gains `databaseSchema?: string`.

## Backend → Python (pattern prompt only)

- `LlmService.streamPatternResponse` (`backend/src/llm/llm.service.ts`) already loads the `exercise` row. Pass `exercise.databaseSchema ?? undefined` as a new `database_schema` field in the POST body to `/generate-patterns`, alongside the existing `rules`.
- Checkpoint generation (`streamResponse` → `/generate-checkpoints`) is **not** changed — schema is patterns-only, per requirement.

## Python service

- `models.py`: `GeneratePatternsRequest` gains `database_schema: Optional[str] = None`.
- `prompts/patterns_prompts.py`: new helper alongside `build_rules_text`:

  ```python
  def build_schema_text(schema: Optional[str]) -> str:
      """Build the database-schema sentence injected into the patterns prompt, or '' if absent."""
      if not schema:
          return ""
      return f"Σχήμα βάσης δεδομένων:\n{schema}\n\n"
  ```

- `USER_PROMPT_PATTERNS` gets a new `{schema_text}` placeholder, inserted immediately before `{rules_text}`.
- `llm_service.py`: wherever `rules_text=build_rules_text(request.rules)` is passed into `USER_PROMPT_PATTERNS.format(...)` (pattern generation only, not checkpoint generation), add `schema_text=build_schema_text(request.database_schema)`.

## Frontend

**API client (`lib/api.ts`)**
- `Exercise` interface gains `databaseSchema?: string`.
- `api.exercises.uploadSchema(id: string, file: File): Promise<Exercise>` — multipart POST to `/api/exercises/:id/schema`.
- `api.exercises.deleteSchema(id: string): Promise<Exercise>` — DELETE to `/api/exercises/:id/schema`.

**Hooks**
- `hooks/use-upload-schema.ts` and `hooks/use-delete-schema.ts`, following the `use-replace-rules.ts` convention (thin `useMutation` wrappers). Callers invalidate the exercise detail query (`[QueryKeys.Exercise, exerciseId]`) on success so the new `databaseSchema` value refetches.

**Component — `components/Exercise/SchemaCard.tsx`**
- Mirrors `RulesCard.tsx`'s structure and visual style (Card/CardBody/VStack, Greek copy, brand-colored action button).
- Heading: "Σχήμα Βάσης Δεδομένων" (or similar) with a short explanatory line, e.g. "Αυτό το σχήμα θα χρησιμοποιηθεί κατά τη δημιουργία regex patterns."
- File input restricted to `.txt` client-side (same validation convention as the existing uploader).
- States:
  - No schema yet: file picker + "Ανέβασμα" button.
  - Schema present: filename/indicator + "Προβολή" button (opens modal) + delete (X) icon button (calls delete mutation) + ability to upload a new file to replace it.
- "Προβολή" opens a Chakra `Modal size="full"` with the schema text rendered in a scrollable monospace block (e.g. `<Text as="pre" whiteSpace="pre-wrap" fontFamily="mono">`), header with title + close button.

**Page wiring (`pages/ExerciseDetailPage.tsx`)**
- Import `SchemaCard` and render it directly above `RulesCard`, gated by the same condition: `{!isProject && <SchemaCard exerciseId={exercise.id} schema={exercise.databaseSchema} />}`.

## Out of Scope

- No effect on checkpoint-generation prompt.
- No effect on PROJECT-type exercises (gated off, same as Rules).
- No versioning/history of schema uploads — each upload replaces the previous text.
- No schema validation/parsing — stored as opaque text.
