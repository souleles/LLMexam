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

### SSE Endpoints (LlmModule)
- `GET /api/llm/chat` — checkpoint extraction streaming
- `GET /api/llm/chat-patterns` — pattern generation streaming

Both use `@Sse()` decorator + `Observable<MessageEvent>` piped from async generator.

### Proxying SSE from Python Service (LlmService)
- Uses `axios` with `responseType: 'stream'`
- `streamResponse` → POSTs to `/generate-checkpoints` with `{ text, history (CHECKPOINT type), message, current_checkpoints }`; saves with `ConversationType.CHECKPOINT`
- `streamPatternResponse` → POSTs to `/generate-patterns` with `{ checkpoints, history (PATTERN type), message }`; saves with `ConversationType.PATTERN`
- Saves professor message before streaming, saves full assistant response after

### Conversation Type Filtering
- `Conversation` model has `type: ConversationType` field (`CHECKPOINT` | `PATTERN`, default `CHECKPOINT`)
- `GET /api/conversations?exerciseId=xxx&type=CHECKPOINT` returns only checkpoint conversations
- `LlmService.getConversationHistory(exerciseId, type?)` filters by type

### Checkpoint Bulk Replace & Pattern Update
```typescript
// POST /api/checkpoints/bulk/:exerciseId  — replaces all checkpoints (deleteMany + createMany)
// PATCH /api/checkpoints/bulk-patterns/:exerciseId  — updates only `pattern` field by order index
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
