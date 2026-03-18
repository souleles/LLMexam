# ExamChecker — AI Working Instructions & Project Reference

## Project Overview

ExamChecker is a web application for university professors to:
1. Upload exercise PDFs and chat with an LLM to extract structured grading checkpoints
2. Upload batches of student submissions
3. Automatically grade submissions against checkpoints using **deterministic** regex/pattern matching

**Core principle: LLM is used ONLY during exercise setup. All grading is deterministic and reproducible.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite + TypeScript), shadcn/ui or Chakra UI, React Query, SSE |
| Backend | NestJS (TypeScript), PostgreSQL via TypeORM or Prisma |
| Python Service | FastAPI, LangChain, pdfplumber, sqlparse |
| Database | PostgreSQL |

---

## 3-Phase Workflow

### Phase 1: Exercise Upload & Checkpoint Extraction
1. Professor uploads exercise PDF via React frontend
2. NestJS receives PDF, forwards to Python microservice
3. Python extracts text via `pdfplumber`
4. LangChain runs **two-pass** LLM extraction:
   - Pass 1: extract all tasks/requirements as structured list
   - Pass 2: for each requirement, generate: description, regex patterns, `match_mode` (any|all), `check_type` (keyword|structural)
5. LLM response streams back via SSE → NestJS SSE proxy → React chat UI
6. Professor reviews/refines via chat (conversation history in PostgreSQL, trimmed context)
7. On approval: checkpoint JSON is Zod-validated and stored in PostgreSQL

### Phase 2: Student Submission Upload
- Supported: `.sql`, `.txt`, `.py`, `.pdf`, `.docx`
- `.sql/.txt/.py`: read directly in NestJS
- `.pdf`: forward to Python microservice
- `.docx`: Node library or Python microservice

### Phase 3: Automated Grading (NO LLM)
For each student file × each checkpoint:
1. Strip comments (SQL: `--` and `/* */`, Python: `#`)
2. Strip string literals
3. Match by `check_type`:
   - `keyword`: regex against `patterns[]`
   - `structural`: sqlparse token tree or AST
4. Store: `matched`, `confidence`, `matched_patterns`, `matched_snippets` (line + text)

---

## Database Schema

```sql
-- exercises
id UUID PK | title VARCHAR | original_pdf_path VARCHAR
extracted_text TEXT | status ENUM(draft,approved) | created_at | updated_at

-- conversation_messages
id UUID PK | exercise_id FK | role ENUM(professor,assistant) | content TEXT | created_at

-- checkpoints
id UUID PK | exercise_id FK | description VARCHAR
patterns JSONB | match_mode ENUM(any,all) | check_type ENUM(keyword,structural)
case_sensitive BOOLEAN DEFAULT false | order_index INTEGER

-- submissions
id UUID PK | exercise_id FK | student_identifier VARCHAR
original_file_path VARCHAR | extracted_text TEXT | created_at

-- grading_results
id UUID PK | submission_id FK | checkpoint_id FK
matched BOOLEAN | confidence FLOAT
matched_patterns JSONB | matched_snippets JSONB
```

---

## NestJS Module Map

| Module | Responsibility |
|--------|---------------|
| `ExerciseModule` | PDF upload, exercise CRUD |
| `LlmModule` | SSE proxy to Python microservice, streaming endpoint |
| `CheckpointModule` | Checkpoint CRUD, Zod validation, approval flow |
| `GradingModule` | Student file upload, matching pipeline, result storage |
| `ReportModule` | Per-student and per-exercise result aggregation |

---

## Python Microservice Endpoints (FastAPI, internal only)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/extract-pdf` | Receives PDF file, returns extracted text |
| POST | `/generate-checkpoints` | Receives text + conversation history, streams LLM via SSE |
| POST | `/parse-sql` | Receives SQL text, returns sqlparse token tree |

---

## Build Order Roadmap

1. Set up monorepo structure (`frontend/`, `backend/`, `python-service/`)
2. Set up PostgreSQL schema with migrations
3. Build Python microservice (PDF extraction + LangChain)
4. Build NestJS `LlmModule` with SSE proxy to Python service
5. Build React chat interface consuming SSE stream
6. Build checkpoint approval and storage flow
7. Build student upload and grading pipeline
8. Build results dashboard

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
- No co-author lines for AI tools in commit messages

---

## Service Ports (local dev)

| Service | Port |
|---------|------|
| Frontend (Vite) | 3000 |
| Backend (NestJS) | 3001 |
| Python service (FastAPI) | 8000 |
| PostgreSQL | 5432 |

> Note: Port 5000 on macOS is often occupied by AirPlay Receiver — avoid it.

---

## Key Documents

- `docs/architecture.md` — Mermaid architecture diagram + data flow
- `docs/decisions/` — Architecture Decision Records (ADRs)
- `docs/runbooks/local-dev.md` — Full local development setup
- `docs/runbooks/database-setup.md` — PostgreSQL schema + migrations
- `tools/prompts/checkpoint-extraction.md` — LLM prompt templates
