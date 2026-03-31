# Frontend — Claude Context

## Stack
- **React** (Vite + TypeScript)
- **UI:** Chakra UI
- **Data fetching:** React Query (`@tanstack/react-query` v5)
- **SSE:** native `EventSource` API via `useLlmStream` hook
- **HTTP:** Axios via `httpClient` (withCredentials: true)

## Pages & Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/exercises` | `ExercisesPage` | List all exercises |
| `/exercises/new` | `NewExercisePage` | Upload PDF + create exercise |
| `/exercises/:exerciseId` | `ExerciseDetailPage` | 2-tab chat (Checkpoints + Patterns) + checkpoints panel |
| `/student-exercises` | `StudentExercisesPage` | Upload & grade student submissions |

## Key Components

- **`ExerciseDetailPage`** — 2-tab Chakra `Tabs` card: Tab 1 = Checkpoints chat, Tab 2 = Patterns chat (disabled until checkpoints saved). Both tabs use `InlineChat` inline component.
- **`InlineChat`** (inline in ExerciseDetailPage) — self-contained chat component: fetches its own DB history by type (`CHECKPOINT`/`PATTERN`), uses `useLlmStream` with `mode`, shows "Accept" button when pending data available, pre-populates input when no history
- **`FileUploader`** — drag-and-drop file upload
- **`Layout`** — navigation shell

## SSE / Chat Pattern

```typescript
// useLlmStream(exerciseId, mode) — custom hook in hooks/useLlmStream.ts
// - mode: 'checkpoints' → /api/llm/chat, 'patterns' → /api/llm/chat-patterns
// - Opens EventSource on send
// - Strips "data: " prefix from raw SSE chunks
// - Splits multi-line events on \n\n
// - Parses { type: "checkpoints", data: [...] } events → pendingCheckpoints state
// - Parses { type: "patterns", data: [...] } events → pendingPatterns state
// - Parses plain text tokens → buffer state
// - Exposes: buffer, streaming, sendMessage, pendingCheckpoints, clearPendingCheckpoints, pendingPatterns, clearPendingPatterns
```

## Chat State Management (InlineChat)

1. `dbMessages` fetched once on load via React Query (`staleTime: Infinity`) filtered by `type` (`CHECKPOINT`/`PATTERN`)
2. Seeded into `messages` state via `useEffect` + `seeded` ref (runs once)
3. Input pre-populated with default prompt when no history
4. On send: professor bubble appended to `messages` immediately
5. While streaming: live bubble shown from `buffer` (gated by `streaming && buffer`)
6. On `[DONE]`: `prevStreaming` ref detects transition → assistant bubble finalized into `messages`
7. Checkpoints/Patterns only saved to DB when user clicks "Accept" button

## Content Parsing

- `lib/parseMessageContent.ts` — shared util that strips `data:` prefixes, parses checkpoint JSON → numbered list text, handles OpenAI delta format
- Applied to DB messages on seed (raw SSE stored in DB gets cleaned on display)

## API Calls

```typescript
// Always use React Query for REST — no raw fetch in components
// All API methods in lib/api.ts
// Mutations use useMutation, invalidate relevant query keys on success
```

## File Upload

- Validate file types client-side before upload: `.sql`, `.txt`, `.py`, `.pdf`, `.docx`, `.js`, `.ts`, `.tsx`
- Use `FormData` — backend expects `multipart/form-data`

## AI Instructions for This Service

- Study existing components before creating new ones
- Use React Query for all API calls — no raw `fetch` in components
- Keep SSE logic in `useLlmStream`, not inside components
- Do not add UI features not explicitly requested
- Match Chakra UI conventions exactly
