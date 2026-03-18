# Backend — Claude Context

## Stack
- **NestJS** (TypeScript)
- **ORM:** TypeORM or Prisma (TBD — decide before first migration)
- **Database:** PostgreSQL
- **SSE:** `@nestjs/common` `Sse()` decorator + `Observable<MessageEvent>`

## Module Map

| Module | Files | Responsibility |
|--------|-------|---------------|
| `ExerciseModule` | `exercise.controller.ts`, `exercise.service.ts`, `exercise.entity.ts` | PDF upload, exercise CRUD |
| `LlmModule` | `llm.controller.ts`, `llm.service.ts` | SSE proxy to Python microservice |
| `CheckpointModule` | `checkpoint.controller.ts`, `checkpoint.service.ts`, `checkpoint.entity.ts` | Checkpoint CRUD, Zod validation, approval |
| `GradingModule` | `grading.controller.ts`, `grading.service.ts` | Student file upload, matching pipeline |
| `ReportModule` | `report.controller.ts`, `report.service.ts` | Result aggregation and export |

## Key Patterns

### SSE Endpoint (LlmModule)
```typescript
import { Sse, MessageEvent, Controller, Get, Query } from '@nestjs/common';
import { Observable } from 'rxjs';

@Controller('llm')
export class LlmController {
  constructor(private llmService: LlmService) {}

  @Sse('chat')
  @Get()
  chat(@Query('exercise_id') exerciseId: string, @Query('message') message: string): Observable<MessageEvent> {
    return this.llmService.streamChat(exerciseId, message);
  }
}
```

### Proxying SSE from Python Service
```typescript
// In LlmService — fetch SSE from Python and re-emit as Observable
streamChat(exerciseId: string, message: string): Observable<MessageEvent> {
  return new Observable((subscriber) => {
    const history = await this.getConversationHistory(exerciseId);

    const response = await fetch(`${PYTHON_SERVICE_URL}/generate-checkpoints`, {
      method: 'POST',
      body: JSON.stringify({ text, history, message }),
      headers: { 'Content-Type': 'application/json' },
    });

    const reader = response.body.getReader();
    // pump reader → subscriber.next({ data: chunk })
    // on done → subscriber.complete()
  });
}
```

### Zod Validation (Checkpoint Approval)
```typescript
import { z } from 'zod';

const CheckpointSchema = z.object({
  description: z.string().max(500),
  patterns: z.array(z.string()).min(1),
  match_mode: z.enum(['any', 'all']),
  check_type: z.enum(['keyword', 'structural']),
  case_sensitive: z.boolean().default(false),
  order_index: z.number().int().min(0),
});

// In CheckpointService.approve():
const validated = z.array(CheckpointSchema).min(1).parse(rawCheckpoints);
```

### Python Service HTTP Calls
```typescript
// Use a shared HttpModule (NestJS built-in Axios wrapper)
// Configure PYTHON_SERVICE_URL from env — never hardcode
const url = this.configService.get<string>('PYTHON_SERVICE_URL');
const { data } = await this.httpService.post(`${url}/extract-pdf`, formData).toPromise();
```

## Grading Pipeline (GradingModule)

For each submission × checkpoint:
1. Load `extracted_text` from DB
2. Strip comments: SQL (`--`, `/* */`), Python (`#`), etc.
3. Strip string literals
4. If `check_type === 'keyword'`: run regex for each pattern in `patterns[]`
5. If `check_type === 'structural'`: POST to Python `/parse-sql`, analyze token tree
6. Compute `matched`, `confidence` (matched count / total patterns), `matched_snippets`
7. Upsert `grading_results`

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
