# ADR-0003: Separate Python Microservice for PDF, LLM, and Grading Work

**Date:** 2026-03-19
**Amended:** 2026-05-05
**Status:** Amended
**Deciders:** Project author (thesis)

---

## Context

The system needs to:
1. Extract text from PDF files (`pdfplumber`)
2. Call an LLM via LangChain with streaming SSE responses (checkpoint + pattern generation)
3. Grade student submissions with regex (`re` module)
4. Grade student submissions semantically (LLM / GPT-4o)
5. Generate mini student reports (LLM)
6. Parse SQL syntax trees (`sqlparse`) for structural analysis

The main backend is NestJS (TypeScript/Node). All capabilities listed above have
far superior Python library support:

- `pdfplumber` is Python-only; Node PDF libraries are less reliable for complex layouts
- `LangChain` (Python) is the most mature LangChain implementation; the JS version lags
- `re` (Python's regex module) is used to keep grading logic co-located with PDF/LLM work
- `sqlparse` is Python-only; no equivalent Node library exists for proper SQL AST parsing

---

## Decision

A separate **FastAPI (Python) microservice** handles all PDF extraction, LLM calls,
regex grading, semantic grading, and SQL parsing. NestJS acts as the orchestrator,
calling this internal service over HTTP.

The microservice is **not exposed to the frontend** — all traffic routes through NestJS.

### Python Microservice Endpoints (FastAPI :8000)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/extract-pdf` | PDF text extraction via pdfplumber |
| POST | `/generate-checkpoints` | LangChain two-pass checkpoint generation (SSE stream) |
| POST | `/generate-patterns` | LangChain pattern refinement (SSE stream) |
| POST | `/grade` | Deterministic regex grading |
| POST | `/grade-llm` | LLM semantic grading (GPT-4o) |
| POST | `/generate-mini-report` | LLM-generated student performance report (Greek) |
| POST | `/parse-sql` | SQL syntax tree via sqlparse |

### Internal Services

| File | Responsibility |
|------|---------------|
| `pdf_service.py` | pdfplumber PDF text extraction |
| `llm_service.py` | LangChain checkpoint + pattern generation, SSE streaming |
| `grading_service.py` | Regex-based grading with SQL block splitting |
| `llm_grading_service.py` | GPT-4o semantic grading with line-annotated code |
| `sql_service.py` | sqlparse SQL token tree parsing |

---

## Consequences

### Positive
- Best-in-class libraries for PDF, LLM, regex, and SQL work
- Clean separation of concerns: NestJS = REST API + DB; Python = AI/parsing/grading
- Each service can be deployed and scaled independently
- Python service can be replaced or upgraded without touching NestJS
- All grading logic (regex + LLM) stays co-located in one place

### Negative
- Added operational complexity: two backend processes to run and monitor
- Extra HTTP hop for PDF, grading, and SQL operations
- Two languages to maintain (TypeScript + Python)
- SSE streaming must be proxied through NestJS (NestJS receives SSE from Python, re-emits to frontend)

### Neutral
- Python service runs on port 8000; NestJS on 3001 (no port conflicts locally)
- Communication is plain HTTP POST (no message queue needed at this scale)

## Alternatives Considered

| Alternative | Reason rejected |
|-------------|----------------|
| All in NestJS (Node only) | Node PDF/SQL/LangChain libraries are inferior |
| All in Python (FastAPI only) | Lose NestJS module system, Prisma, decorators, guards |
| Serverless functions for Python | Cold starts hurt streaming; overkill for thesis |
| gRPC between services | Adds complexity with no benefit at this scale |

## References

- `docs/runbooks/local-dev.md` — how to run both services together
- `docs/architecture.md` — full service diagram and data flow
- `python-service/services/` — all Python service implementations
