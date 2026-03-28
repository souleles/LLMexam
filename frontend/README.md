# ExamChecker Frontend

Modern, responsive React frontend for the ExamChecker application.

## Tech Stack

- **React 18** with TypeScript
- **Vite** - Fast build tool and dev server
- **Chakra UI** - Modern component library
- **React Query** - Server state management
- **React Router** - Client-side routing
- **Axios** - HTTP client with interceptors

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```powershell
# Install dependencies
npm install

# Copy environment variables
Copy-Item .env.example .env

# Start development server
npm run dev
```

The app will be available at http://localhost:3000

### Build for Production

```powershell
npm run build
npm run preview
```

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── ChatInterface/   # SSE-powered chat for checkpoint extraction
│   ├── CheckpointList/  # Display extracted checkpoints
│   ├── CreateExerciseModal/
│   ├── FileUploader/    # Drag-and-drop file upload
│   └── Layout/          # App layout and navigation
├── hooks/               # Custom React hooks
│   └── useLlmStream.ts # SSE streaming for LLM responses
├── lib/                # Core utilities
│   ├── api.ts          # Typed API client
│   ├── httpClient.ts   # Axios instance with interceptors
│   └── queryClient.ts  # React Query configuration
├── pages/              # Route pages
│   ├── ExercisesPage.tsx       # Exercise list
│   ├── ExerciseSetupPage.tsx   # Phase 1: PDF upload + chat
│   ├── SubmissionsPage.tsx     # Phase 2: Student uploads
│   └── GradingResultsPage.tsx  # Phase 3: Results dashboard
├── theme/              # Chakra UI theme customization
├── App.tsx            # Route configuration
└── main.tsx           # App entry point
```

## Key Features

### 1. Exercise Management
- Create exercises by uploading PDF files
- View all exercises with status badges (draft/approved)
- Delete exercises

### 2. Checkpoint Extraction (Phase 1)
- Real-time chat interface with AI assistant
- SSE streaming for instant feedback
- Visual checkpoint list with regex patterns
- Approve checkpoints when ready

### 3. Student Submissions (Phase 2)
- Drag-and-drop file upload
- Support for: `.sql`, `.txt`, `.py`, `.pdf`, `.docx`, `.js`, `.ts`, `.tsx`
- Batch upload up to 50 files
- Submission tracking

### 4. Grading Results (Phase 3)
- Overview table with scores and percentages
- Detailed results per student
- Per-checkpoint matching status
- Line-by-line matched snippets
- Save results to database

## API Integration

All API calls use React Query for caching, loading states, and error handling:

```typescript
// Example: Fetching exercises
const { data: exercises, isLoading } = useQuery({
  queryKey: ['exercises'],
  queryFn: api.exercises.list,
});

// Example: Creating an exercise
const mutation = useMutation({
  mutationFn: api.exercises.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['exercises'] });
  },
});
```

### SSE Streaming

Chat messages use Server-Sent Events for real-time LLM responses:

```typescript
const { buffer, streaming, sendMessage } = useLlmStream(exerciseId);
```

## Environment Variables

```
VITE_API_BASE_URL=http://localhost:3001
```

## Development Guidelines

- **Read before modifying** - Understand existing patterns
- **Use React Query** - All API calls go through React Query
- **Keep SSE in hooks** - Don't put EventSource logic in components
- **Validate file types** - Client-side validation before upload
- **Match Chakra patterns** - Use Chakra components and theming

## Available Scripts

- `npm run dev` - Start development server on port 3000
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint code with ESLint

## Design System

### Colors

- **Primary (Brand)**: Blue gradient (`brand.50` - `brand.900`)
- **Success**: Green for approved/matched states
- **Warning**: Yellow for draft states
- **Error**: Red for not found/failed states

### Responsive Breakpoints

- `base`: 0px (mobile)
- `md`: 768px (tablet)
- `lg`: 992px (desktop)
- `xl`: 1280px (wide desktop)

### Typography

- **Heading**: Inter font family
- **Body**: Inter font family

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### CORS Issues

Make sure backend is running on port 3001 and has CORS enabled for http://localhost:3000

### SSE Connection Fails

Check that:
1. Backend `/api/llm/chat` endpoint is available
2. Exercise ID is valid
3. Network tab shows EventSource connection

### File Upload Fails

Verify:
1. File type is in allowed list
2. File size is reasonable
3. Backend multipart/form-data handling is working
