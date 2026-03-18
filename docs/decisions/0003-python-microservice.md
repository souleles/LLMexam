# ADR-0003: Separate Python Microservice for PDF and LLM Work

**Date:** 2026-03-19
**Status:** Accepted
**Deciders:** Project author (thesis)

---

## Context

The system needs to:
1. Extract text from PDF files (`pdfplumber`)
2. Call an LLM via LangChain with streaming SSE responses
3. Parse SQL syntax trees (`sqlparse`) for structural grading checks

The main backend is NestJS (TypeScript/Node). All three capabilities listed above have
far superior Python library support:

- `pdfplumber` is Python-only; Node PDF libraries are less reliable for complex layouts
- `LangChain` (Python) is the most mature LangChain implementation; the JS version lags
- `sqlparse` is Python-only; no equivalent Node library exists for proper SQL AST parsing

---

## Decision

Create a separate **FastAPI (Python) microservice** that handles all PDF extraction,
LLM calls, and SQL parsing. NestJS acts as the orchestrator, calling this internal
service over HTTP.

The Python microservice exposes three endpoints:
- `POST /extract-pdf` — PDF text extraction
- `POST /generate-checkpoints` — LLM checkpoint generation with SSE streaming
- `POST /parse-sql` — SQL structural analysis

The microservice is **not exposed to the frontend** — all traffic routes through NestJS.

---

## Consequences

### Positive
- Best-in-class libraries for PDF, LLM, and SQL work
- Clean separation of concerns: NestJS = REST API + DB; Python = AI/parsing
- Each service can be deployed and scaled independently
- Python service can be replaced or upgraded without touching NestJS

### Negative
- Added operational complexity: two backend processes to run and monitor
- Extra HTTP hop for PDF and SQL operations (acceptable for non-grading paths)
- Two languages to maintain (TypeScript + Python)
- SSE streaming must be proxied through NestJS (NestJS receives SSE from Python, re-emits to frontend)

### Neutral
- Python service runs on port 8000; NestJS on 3001 (no port conflicts locally)
- Communication is plain HTTP (no message queue needed at this scale)

## Alternatives Considered

| Alternative | Reason rejected |
|-------------|----------------|
| All in NestJS (Node only) | Node PDF/SQL/LangChain libraries are inferior |
| All in Python (FastAPI only) | Lose NestJS's module system, TypeORM/Prisma, decorators |
| Serverless functions for Python | Overkill for a thesis project; cold starts hurt streaming |
| gRPC between services | Adds complexity with no benefit at this scale |

## References

- `docs/runbooks/local-dev.md` — how to run both services together
- `python-service/CLAUDE.md` — Python service implementation guide
