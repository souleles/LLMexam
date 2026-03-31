# Backend — Claude Context

## Stack
- **NestJS** (TypeScript)
- **ORM:** Prisma
- **Database:** PostgreSQL
- **SSE:** `@nestjs/common` `Sse()` decorator + `Observable<MessageEvent>`

## Module Map

| Module | Files | Responsibility |
|--------|-------|---------------|
| `ExerciseModule` | `exercises.controller.ts`, `exercises.service.ts` | PDF upload, exercise CRUD |
| `LlmModule` | `llm.controller.ts`, `llm.service.ts` | SSE proxy to Python microservice, conversation history |
| `CheckpointModule` | `checkpoints.controller.ts`, `checkpoints.service.ts` | Checkpoint CRUD, bulk replace, approval |
| `SubmissionsModule` | `submissions.controller.ts`, `submissions.service.ts` | Student file upload, text extraction |
| `GradingModule` | `grading.controller.ts`, `grading.service.ts` | Regex matching pipeline, result storage |

## Key Patterns

### SSE Endpoint (LlmModule)
```typescript
@Sse('chat')
chat(@Query('exercise_id') exerciseId: string, @Query('message') message: string): Observable<MessageEvent> {
  return new Observable((subscriber) => {
    (async () => {
      for await (const chunk of this.llmService.streamResponse(exerciseId, message)) {
        subscriber.next({ data: chunk });
      }
      subscriber.complete();
    })();
  });
}
```

### Proxying SSE from Python Service (LlmService)
- Uses `axios` with `responseType: 'stream'`
- POSTs to `${PYTHON_SERVICE_URL}/generate-checkpoints` with `{ text, history, message, current_checkpoints }`
- Saves professor message before streaming, saves full assistant response after
- Streams raw chunks back to the NestJS SSE subscriber

### Checkpoint Bulk Replace
```typescript
// POST /api/checkpoints/bulk/:exerciseId
// Replaces all checkpoints for an exercise atomically (deleteMany + createMany in transaction)
```

## Grading Pipeline (GradingModule)

For each submission × checkpoint:
1. Load `extracted_text` from DB
2. Strip comments: SQL (`--`, `/* */`), Python (`#`)
3. Strip string literals
4. Run regex for each pattern in `patterns`
5. Compute `matched`, `matched_snippets` (file + line)
6. Upsert `grading_results`

## Environment Variables

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/examchecker
PYTHON_SERVICE_URL=http://localhost:8000
PORT=3001
```

## AI Instructions for This Service

- Always check the module structure before adding a new endpoint
- Use `ConfigService` for all env vars — never `process.env` directly in services
- Keep grading logic in `GradingModule`, not in controllers
- All Python service calls go through `LlmModule` (for LLM) or directly in the relevant service (for PDF/SQL)
- Use DTOs with class-validator for all incoming request bodies
- Log all Python service errors with request context before re-throwing
