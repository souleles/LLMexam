# ExamChecker — AI Working Instructions & Project Reference

## Project Overview

ExamChecker is a web application for university professors to:
1. Upload exercise PDFs and chat with an LLM to extract structured grading checkpoints
2. Upload batches of student submissions (as ZIP/RAR archives)
3. Automatically grade submissions using **deterministic regex** and/or **LLM semantic** matching
4. Review, compare, and optionally override grades; generate per-student narrative reports

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite + TypeScript), Chakra UI, React Query, SSE |
| Backend | NestJS (TypeScript), PostgreSQL via Prisma, JWT Auth |
| Python Service | FastAPI, LangChain, pdfplumber, sqlparse |
| Database | PostgreSQL |

---

## 3-Phase Workflow

### Phase 1: Exercise Upload & Checkpoint Extraction
1. Professor uploads exercise PDF via React frontend
2. NestJS receives PDF, forwards to Python `/extract-pdf` (pdfplumber)
3. Python returns extracted text; NestJS creates an exercise with `status: DRAFT`
4. Professor chats with LLM via SSE stream (`GET /llm/chat`) to generate checkpoints
5. Professor optionally refines patterns via second chat tab (`GET /llm/chat-patterns`)
6. Both chats stream through NestJS → Python → OpenAI (LangChain `astream`)
7. Frontend parses SSE JSON chunks into structured `PendingCheckpoint[]`
8. On "Accept": frontend calls `POST /checkpoints/bulk/:exerciseId` to save; NestJS validates each regex
9. Exercise status set to `APPROVED`

### Phase 2: Student Submission Upload
- Professor selects student(s) + uploads a ZIP or RAR archive
- Supported file types inside archive: `.sql`, `.txt`, `.py`, `.js`, `.ts`, `.tsx`, `.pdf`, `.docx`
- `.pdf` forwarded to Python `/extract-pdf`; others read directly in NestJS
- All extracted content concatenated with `// File: <path>` markers → stored as `submission.content`
- Submission linked to student(s) via `submission_students` M:M junction table
- Grading runs automatically immediately after upload (method chosen by professor: `regex` or `llm`)

### Phase 3: Automated Grading
Two grading methods can be run on the same submission; results are stored separately.

**Method A — Deterministic Regex** (Python `grading_service.py`, via `/grade`):
1. For each checkpoint, compile `re.compile(pattern, flags)` (IGNORECASE unless caseSensitive)
2. For `.sql` content: split into blocks (PROCEDURE/TRIGGER/FUNCTION/EVENT) before matching
3. Search each file; collect `{file, line_number, full_line_text}` snippets
4. Store in `checkpoint_results.matched` + `.matchedSnippets`
5. Aggregate: `grading_results.score = (passedCheckpoints / totalCheckpoints) * 100`

**Method B — LLM Semantic** (Python `llm_grading_service.py`, via `/grade-llm`):
1. Annotate each file with line numbers (`"  42 | code line text"`)
2. Format checkpoints: `ID`, `Description`, `Regex hint`
3. Call GPT-4o (via LangChain) requesting structured JSON output
4. LLM returns `{checkpoint_id, matched, matched_snippets[]}`
5. Store in `checkpoint_results.llmMatched` + `.llmMatchedSnippets`
6. Aggregate: `grading_results.llmScore`

Both scores coexist. Professor can also set `teacherScore` as a manual override.

---

## Database Schema

```sql
-- users (teacher authentication)
id UUID PK | username (unique) | password (hashed) | role | createdAt | updatedAt

-- exercises
id UUID PK | title | pdfUrl | extractedText
status ENUM(DRAFT, APPROVED, GRADED)
teacherid FK→users | createdAt | updatedAt

-- checkpoints
id UUID PK | exerciseId FK (CASCADE) | order INT
description | pattern (regex string) | caseSensitive BOOLEAN
patternDescription | indicatorSolution
createdAt | updatedAt

-- conversations (chat history, two types)
id UUID PK | exerciseId FK (CASCADE)
role ENUM(PROFESSOR, ASSISTANT)
content TEXT
type ENUM(CHECKPOINT, PATTERN)
createdAt

-- submissions
id UUID PK | exerciseId FK (CASCADE)
fileName | fileUrl | fileType | content (combined text from archive)
createdAt | updatedAt

-- submission_students (M:M junction)
id UUID PK | submissionId FK (CASCADE) | studentId FK (CASCADE)
createdAt | UNIQUE(submissionId, studentId)

-- grading_results (one per submission)
id UUID PK | submissionId FK UNIQUE (CASCADE)
totalCheckpoints | passedCheckpoints | score FLOAT
teacherScore FLOAT? (override) | gradedAt
llmPassedCheckpoints INT? | llmScore FLOAT?

-- checkpoint_results (one per checkpoint per grading)
id UUID PK | gradingResultId FK (CASCADE) | checkpointId FK (CASCADE)
matched BOOLEAN | matchedSnippets String[]    -- regex grading
llmMatched BOOLEAN? | llmMatchedSnippets String[]  -- LLM grading
UNIQUE(gradingResultId, checkpointId)

-- students
id UUID PK | studentIdentifier (unique) | firstName | lastName | email?
miniReport TEXT? | miniReportAt DateTime? | teacherid FK→users | createdAt | updatedAt
```

---

## NestJS Module Map

| Module | Responsibility |
|--------|---------------|
| `AuthModule` | JWT register/login, guards |
| `ExercisesModule` | PDF upload, exercise CRUD, approve action |
| `LlmModule` | SSE proxy to Python for checkpoint + pattern generation |
| `CheckpointsModule` | Checkpoint CRUD, bulk save, regex validation |
| `ConversationsModule` | Chat history storage (CHECKPOINT + PATTERN types) |
| `SubmissionsModule` | ZIP/RAR upload, file extraction, grade orchestration |
| `GradingModule` | Grading result CRUD, teacher score override |
| `StudentsModule` | Student management, CSV upload, mini-report generation |

---

## Python Microservice Endpoints (FastAPI :8000, internal only)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/extract-pdf` | PDF text extraction via pdfplumber |
| POST | `/generate-checkpoints` | SSE stream: LLM checkpoint generation (two-pass) |
| POST | `/generate-patterns` | SSE stream: LLM pattern refinement |
| POST | `/grade` | Deterministic regex grading |
| POST | `/grade-llm` | LLM semantic grading (GPT-4o) |
| POST | `/generate-mini-report` | LLM Greek-language student performance report |
| POST | `/parse-sql` | sqlparse SQL token tree |

---

## Build Order Roadmap

1. Set up monorepo structure (`frontend/`, `backend/`, `python-service/`)
2. Set up PostgreSQL schema with Prisma migrations
3. Build Python microservice (PDF extraction + LangChain)
4. Build NestJS `LlmModule` with SSE proxy to Python service
5. Build React chat interface consuming SSE stream
6. Build checkpoint approval and storage flow
7. Build student upload and submission grading pipeline (regex)
8. Build LLM semantic grading as parallel option
9. Build results dashboard with teacher score override
10. Build student management + mini-report generation

---

## AI Working Instructions

- **Read before modifying** — always understand existing code before changing it
- **Minimal, targeted edits** — no extra refactoring, no unsolicited improvements
- **Study 2–3 existing examples** before implementing any new pattern
- **No wrapper components** when direct usage achieves the same result
- **Ask, don't guess** — when the target (file, service, module) is unclear, ask first
- **Secure code** — validate inputs at system boundaries, never hardcode secrets
- **Match existing conventions** — error handling, naming, structure
- **Prefer editing existing files** over creating new ones

### Debugging
- Before any fix: create a numbered plan with max 3 attempts per approach
- After 3 failed attempts: step back and brainstorm alternatives
- List top 3 most likely root causes before trying anything

### Git
- Conventional commits (`feat:`, `fix:`, `chore:`, etc.)
- Atomic commits — one logical change per commit
- No co-author lines in commit messages

---

## Service Ports (local dev)

| Service | Port |
|---------|------|
| Frontend (Vite) | 3000 |
| Backend (NestJS) | 3001 |
| Python service (FastAPI) | 8000 |
| PostgreSQL | 5432 |

---

## Key Documents

- `docs/architecture.md` — Mermaid architecture diagram + data flow sequences
- `docs/decisions/0002-deterministic-grading.md` — ADR: grading strategy (regex + LLM)
- `docs/decisions/0003-python-microservice.md` — ADR: why Python handles grading + PDF + LLM
- `docs/runbooks/local-dev.md` — Full local development setup
- `docs/runbooks/database-setup.md` — PostgreSQL schema + Prisma migrations
