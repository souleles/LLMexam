# Frontend — Claude Context

## Stack
- **React** (Vite + TypeScript)
- **UI:** shadcn/ui or Chakra UI (TBD — decide before implementing first component)
- **Data fetching:** React Query (`@tanstack/react-query`)
- **SSE:** native `EventSource` API for streaming LLM responses

## Key Patterns

### API Calls (React Query)
```typescript
// Always use React Query for REST calls
const { data, isLoading } = useQuery({
  queryKey: ['exercise', exerciseId],
  queryFn: () => api.exercises.get(exerciseId),
});

// Mutations
const mutation = useMutation({
  mutationFn: (data) => api.checkpoints.approve(data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercise'] }),
});
```

### SSE Consumption Pattern
```typescript
// Each chat message opens a new EventSource connection
// Backend: GET /llm/chat?exercise_id=X&message=Y (SSE)
// Do NOT reuse EventSource across messages

function useLlmStream(exerciseId: string) {
  const [buffer, setBuffer] = useState('');
  const [streaming, setStreaming] = useState(false);

  const sendMessage = useCallback((message: string) => {
    setStreaming(true);
    setBuffer('');

    const es = new EventSource(
      `/api/llm/chat?exercise_id=${exerciseId}&message=${encodeURIComponent(message)}`
    );

    es.onmessage = (e) => {
      if (e.data === '[DONE]') {
        es.close();
        setStreaming(false);
        return;
      }
      setBuffer((prev) => prev + e.data);
    };

    es.onerror = () => {
      es.close();
      setStreaming(false);
    };
  }, [exerciseId]);

  return { buffer, streaming, sendMessage };
}
```

### File Upload (exercise PDF)
```typescript
// Use FormData — backend expects multipart/form-data
const formData = new FormData();
formData.append('file', file);
formData.append('title', title);

await fetch('/api/exercises', { method: 'POST', body: formData });
```

## Page Structure (planned)

```
src/
  pages/
    ExercisesPage.tsx        # List of exercises
    ExerciseSetupPage.tsx    # Upload PDF + chat interface (Phase 1)
    SubmissionsPage.tsx      # Upload student files (Phase 2)
    GradingResultsPage.tsx   # Results dashboard (Phase 3)
  components/
    ChatInterface/           # SSE-powered chat UI
    CheckpointList/          # Editable checkpoint list
    FileUploader/            # Drag-and-drop file upload
    ResultsTable/            # Grading results grid
  lib/
    api.ts                   # Typed API client
    queryClient.ts           # React Query client setup
```

## AI Instructions for This Service

- Study existing components before creating new ones
- Use React Query for all API calls — no raw `fetch` in components
- Keep SSE logic in custom hooks, not inside components
- Do not add UI features not explicitly requested
- Match the chosen UI library's conventions exactly
- Validate file types client-side before upload (`.sql`, `.txt`, `.py`, `.pdf`, `.docx`)
