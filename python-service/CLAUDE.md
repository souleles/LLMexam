# Python Microservice — Claude Context

## Stack
- **FastAPI** (Python 3.11+)
- **LangChain** (Python) for LLM integration
- **pdfplumber** for PDF text extraction
- **sqlparse** for SQL AST/token analysis
- **python-dotenv** for environment variables
- **uvicorn** as ASGI server

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/extract-pdf` | Receive PDF file (multipart), return extracted text |
| POST | `/generate-checkpoints` | Receive text + history, stream LLM response via SSE |
| POST | `/parse-sql` | Receive SQL text, return sqlparse token tree |
| GET | `/health` | Health check (returns `{"status": "ok"}`) |

## Key Patterns

### PDF Extraction (`/extract-pdf`)
```python
import pdfplumber
from fastapi import UploadFile

@app.post("/extract-pdf")
async def extract_pdf(file: UploadFile):
    contents = await file.read()
    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        text = "\n".join(
            page.extract_text() or "" for page in pdf.pages
        )
    return {"extracted_text": text.strip()}
```

### SSE Streaming (`/generate-checkpoints`)
```python
from fastapi.responses import StreamingResponse
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, AIMessage, SystemMessage

@app.post("/generate-checkpoints")
async def generate_checkpoints(body: GenerateRequest):
    async def stream():
        llm = ChatOpenAI(model="gpt-4o", streaming=True)
        messages = build_messages(body.text, body.history, body.message)

        async for chunk in llm.astream(messages):
            token = chunk.content
            if token:
                yield f"data: {token}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
```

### SQL Parsing (`/parse-sql`)
```python
import sqlparse

@app.post("/parse-sql")
async def parse_sql(body: SqlParseRequest):
    parsed = sqlparse.parse(body.sql_text)
    # Return token tree for NestJS to analyze
    result = []
    for statement in parsed:
        result.append(serialize_tokens(statement.tokens))
    return {"statements": result}
```

## Conversation History Format

```python
class Message(BaseModel):
    role: Literal["professor", "assistant"]
    content: str

class GenerateRequest(BaseModel):
    text: str                    # original exercise extracted text
    current_checkpoints: str     # current checkpoint JSON as string
    history: list[Message]       # trimmed to last N messages
    message: str                 # current professor message
```

Context construction order:
1. System prompt (see `tools/prompts/checkpoint-extraction.md`)
2. Original extraction result
3. Current checkpoint JSON
4. Last N messages from history
5. Current professor message

## Environment Variables

```
OPENAI_API_KEY=sk-...
PORT=8000
```

## Project Structure (planned)

```
python-service/
  main.py              # FastAPI app, routes
  models.py            # Pydantic request/response models
  services/
    pdf_service.py     # pdfplumber logic
    llm_service.py     # LangChain + prompt building
    sql_service.py     # sqlparse token analysis
  prompts/             # Prompt template strings (mirrors tools/prompts/)
  tests/
    test_pdf.py
    test_llm.py
    test_sql.py
  requirements.txt
  .env.example
```

## AI Instructions for This Service

- Keep each endpoint thin — delegate to `services/`
- Use `Pydantic` models for all request/response bodies
- Never load the LLM model at import time — initialize inside the route handler or use dependency injection
- All LLM calls must use `astream` (async streaming) — never block
- Test PDF extraction with both text-based and scanned PDFs (scanned may return empty)
- Use `sqlparse.parse()` — not regex — for any SQL structural check
- Log malformed SQL gracefully, return an empty token tree rather than raising 500
