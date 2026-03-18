# ExamChecker — Architecture

## Service Overview

Three services communicate over HTTP. Only the backend is exposed to the frontend.
The Python microservice is internal-only.

```mermaid
graph TB
    subgraph Browser
        FE["React Frontend<br/>(Vite + TS)<br/>:3000"]
    end

    subgraph "Backend (NestJS :3001)"
        EM[ExerciseModule]
        LM[LlmModule]
        CM[CheckpointModule]
        GM[GradingModule]
        RM[ReportModule]
    end

    subgraph "Python Microservice (FastAPI :8000)"
        EP[POST /extract-pdf]
        GC[POST /generate-checkpoints]
        PS[POST /parse-sql]
    end

    subgraph "PostgreSQL :5432"
        DB[(Database)]
    end

    FE -->|REST + SSE| EM
    FE -->|REST + SSE| LM
    FE -->|REST| CM
    FE -->|REST| GM
    FE -->|REST| RM

    EM -->|multipart| EP
    LM -->|text + history| GC
    GM -->|SQL text| PS

    EM --> DB
    LM --> DB
    CM --> DB
    GM --> DB
    RM --> DB
```

---

## Data Flow by Phase

### Phase 1: Checkpoint Extraction

```mermaid
sequenceDiagram
    participant P as Professor (Browser)
    participant N as NestJS
    participant Py as Python Service
    participant LLM as LLM (OpenAI)
    participant DB as PostgreSQL

    P->>N: POST /exercises (PDF file)
    N->>Py: POST /extract-pdf (multipart)
    Py-->>N: { extracted_text }
    N->>DB: INSERT exercise (draft)
    N-->>P: { exercise_id, extracted_text }

    P->>N: POST /llm/chat (text + history) — SSE
    N->>Py: POST /generate-checkpoints (text + history) — SSE
    Py->>LLM: LangChain two-pass prompt
    LLM-->>Py: stream tokens
    Py-->>N: SSE stream
    N-->>P: SSE stream (chat UI)

    P->>N: POST /checkpoints/approve (exercise_id)
    N->>N: Zod validate checkpoint JSON
    N->>DB: INSERT checkpoints[], UPDATE exercise status=approved
    N-->>P: { checkpoints }
```

### Phase 2: Student Upload

```mermaid
sequenceDiagram
    participant P as Professor (Browser)
    participant N as NestJS
    participant Py as Python Service
    participant DB as PostgreSQL

    P->>N: POST /submissions/batch (files[], exercise_id)
    loop For each file
        alt .sql / .txt / .py
            N->>N: Read text directly
        else .pdf
            N->>Py: POST /extract-pdf
            Py-->>N: { extracted_text }
        else .docx
            N->>N: Extract via docx library
        end
        N->>DB: INSERT submission (student_identifier, extracted_text)
    end
    N-->>P: { submission_ids[] }
```

### Phase 3: Automated Grading (No LLM)

```mermaid
sequenceDiagram
    participant P as Professor (Browser)
    participant N as NestJS
    participant Py as Python Service
    participant DB as PostgreSQL

    P->>N: POST /grading/run (exercise_id)
    N->>DB: SELECT submissions, checkpoints WHERE exercise_id=X

    loop For each submission × checkpoint
        N->>N: Strip comments + string literals
        alt check_type = keyword
            N->>N: Regex match against patterns[]
        else check_type = structural
            N->>Py: POST /parse-sql (sql_text)
            Py-->>N: { token_tree }
            N->>N: Analyze token tree
        end
        N->>DB: INSERT grading_result (matched, confidence, snippets)
    end

    N-->>P: { results_summary }
```

---

## PostgreSQL Schema

```
┌─────────────────────────────────────────────────────────────────┐
│ exercises                                                        │
│ id UUID PK | title | original_pdf_path | extracted_text         │
│ status ENUM(draft,approved) | created_at | updated_at           │
└──────────────────┬──────────────────────────────────────────────┘
                   │ 1:N
    ┌──────────────┼──────────────────┐
    │              │                  │
    ▼              ▼                  ▼
┌───────────┐ ┌───────────┐ ┌────────────────────┐
│conversation│ │checkpoints│ │submissions         │
│_messages  │ │           │ │                    │
│id UUID PK │ │id UUID PK │ │id UUID PK          │
│exercise_id│ │exercise_id│ │exercise_id FK      │
│role ENUM  │ │description│ │student_identifier  │
│content    │ │patterns   │ │original_file_path  │
│created_at │ │JSONB      │ │extracted_text      │
│           │ │match_mode │ │created_at          │
│           │ │check_type │ └────────┬───────────┘
│           │ │case_sens. │          │ 1:N
└───────────┘ │order_index│          ▼
              └─────┬─────┘ ┌────────────────────┐
                    │       │grading_results     │
                    │ 1:N   │id UUID PK          │
                    └──────►│submission_id FK    │
                            │checkpoint_id FK    │
                            │matched BOOLEAN     │
                            │confidence FLOAT    │
                            │matched_patterns    │
                            │JSONB               │
                            │matched_snippets    │
                            │JSONB               │
                            └────────────────────┘
```

---

## Key Design Decisions

- **LLM only in setup** — grading is 100% deterministic regex/AST matching (see ADR-0002)
- **Python microservice** — PDF and LLM work stays in Python; NestJS stays as the REST orchestrator (see ADR-0003)
- **SSE for streaming** — LLM responses stream token-by-token via Server-Sent Events; each chat turn is a fresh HTTP request
- **Conversation trimming** — context sent to LLM = original extraction + current checkpoint JSON + last N messages (prevents token overflow)
- **Zod validation** — checkpoint JSON is validated before storage to ensure pattern integrity
