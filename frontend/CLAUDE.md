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
| `/exercises/:exerciseId` | `ExerciseDetailPage` | Chat interface + checkpoints + history |
| `/student-exercises` | `StudentExercisesPage` | Upload & grade student submissions |

## Key Components

- **`ExerciseDetailPage`** — inline chat (scrollable box, 400px), DB history seeded on load, local state for live session, "Accept Checkpoints" button to save pending checkpoints
- **`FileUploader`** — drag-and-drop file upload
- **`Layout`** — navigation shell

## SSE / Chat Pattern

```typescript
// useLlmStream — custom hook in hooks/useLlmStream.ts
// - Opens EventSource on send
// - Strips "data: " prefix from raw SSE chunks
// - Splits multi-line events on \n\n
// - Parses { type: "checkpoints", data: [...] } events → pendingCheckpoints state
// - Parses plain text tokens → buffer state
// - Exposes: buffer, streaming, sendMessage, pendingCheckpoints, clearPendingCheckpoints
```

## Chat State Management (ExerciseDetailPage)

1. `dbMessages` fetched once on load via React Query (`staleTime: Infinity`)
2. Seeded into `messages` state via `useEffect` + `seeded` ref (runs once)
3. On send: professor bubble appended to `messages` immediately
4. While streaming: live bubble shown from `buffer` (gated by `streaming && buffer`)
5. On `[DONE]`: `prevStreaming` ref detects transition → assistant bubble finalized into `messages`
6. Checkpoints only saved to DB when user clicks "Accept Checkpoints"

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
