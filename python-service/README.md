# ExamChecker Python Microservice

FastAPI service for PDF extraction, LLM checkpoint generation, and SQL parsing.

## Features

- **PDF Text Extraction** - Extract text from exercise PDFs using pdfplumber
- **LLM Checkpoint Generation** - Generate grading checkpoints via OpenAI with streaming
- **SQL Parsing** - Parse SQL text into token trees using sqlparse
- **SSE Streaming** - Real-time Server-Sent Events for LLM responses

## Tech Stack

- **FastAPI** - Modern Python web framework
- **LangChain** - LLM orchestration and streaming
- **pdfplumber** - PDF text extraction
- **sqlparse** - SQL parsing and analysis
- **OpenAI GPT-4o** - LLM for checkpoint generation
- **Uvicorn** - ASGI server

## Setup

### Prerequisites

- Python 3.11 or higher
- OpenAI API key

### Installation

1. **Create virtual environment**:
   ```powershell
   cd python-service
   python -m venv venv
   ```

2. **Activate virtual environment**:
   ```powershell
   # Windows PowerShell
   .\venv\Scripts\Activate.ps1
   
   # Windows CMD
   .\venv\Scripts\activate.bat
   ```

3. **Install dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

4. **Configure environment**:
   ```powershell
   # Copy example env file
   cp .env.example .env
   
   # Edit .env and add your OpenAI API key
   # OPENAI_API_KEY=sk-your-actual-key-here
   ```

### Running the Service

**Development mode (with auto-reload)**:
```powershell
python main.py
```

Or using uvicorn directly:
```powershell
uvicorn main:app --reload --port 8000
```

**Production mode**:
```powershell
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

The service will be available at: `http://localhost:8000`

## API Endpoints

### Health Check

**GET** `/health`

Returns service status.

**Response**:
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

### Extract PDF Text

**POST** `/extract-pdf`

Extract text from uploaded PDF file.

**Request** (multipart/form-data):
- `file`: PDF file

**Response**:
```json
{
  "extracted_text": "Exercise 1: Write a SQL query..."
}
```

**Example**:
```powershell
curl -X POST http://localhost:8000/extract-pdf `
  -F "file=@exercise.pdf"
```

### Generate Checkpoints (SSE Streaming)

**POST** `/generate-checkpoints`

Generate grading checkpoints from exercise text. Streams response via SSE.

**Request Body**:
```json
{
  "text": "Exercise: Write a SQL query that...",
  "current_checkpoints": "[]",
  "history": [
    {
      "role": "professor",
      "content": "Extract checkpoints"
    }
  ],
  "message": "Generate checkpoints for this exercise"
}
```

**Response** (Server-Sent Events):
```
data: [
data: {
data:   "description": "Uses JOIN clause",
...
data: [DONE]
```

**Example**:
```powershell
curl -X POST http://localhost:8000/generate-checkpoints `
  -H "Content-Type: application/json" `
  -H "Accept: text/event-stream" `
  -d '{"text":"Exercise text","message":"Generate checkpoints"}' `
  --no-buffer
```

### Parse SQL

**POST** `/parse-sql`

Parse SQL text into token tree structure.

**Request Body**:
```json
{
  "sql_text": "SELECT * FROM users WHERE id = 1;"
}
```

**Response**:
```json
{
  "statements": [
    [
      {
        "type": "Keyword",
        "value": "SELECT",
        "tokens": null
      }
    ]
  ],
  "success": true,
  "error": null
}
```

**Example**:
```powershell
curl -X POST http://localhost:8000/parse-sql `
  -H "Content-Type: application/json" `
  -d '{"sql_text":"SELECT * FROM users;"}'
```

## Project Structure

```
python-service/
├── main.py                    # FastAPI app and routes
├── models.py                  # Pydantic request/response models
├── requirements.txt           # Python dependencies
├── .env                       # Environment variables (create from .env.example)
├── .env.example              # Example environment configuration
├── services/
│   ├── pdf_service.py        # PDF extraction logic
│   ├── llm_service.py        # LangChain LLM integration
│   └── sql_service.py        # SQL parsing logic
├── prompts/
│   └── checkpoint_prompts.py # LLM prompt templates
└── tests/
    ├── test_pdf.py           # PDF extraction tests
    ├── test_llm.py           # LLM service tests
    └── test_sql.py           # SQL parsing tests
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (required) | - |
| `PORT` | Server port | 8000 |
| `ENVIRONMENT` | Environment (development/production) | development |
| `LOG_LEVEL` | Logging level (DEBUG/INFO/WARNING/ERROR) | INFO |

## Development

### Running Tests

```powershell
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html
```

### Code Formatting

```powershell
# Install dev dependencies
pip install black isort

# Format code
black .
isort .
```

### Type Checking

```powershell
# Install mypy
pip install mypy

# Run type checker
mypy .
```

## Integration with NestJS Backend

The NestJS backend calls this service for:

1. **PDF Extraction** - When professor uploads exercise PDF
2. **Checkpoint Generation** - For initial extraction and refinement conversations
3. **SQL Parsing** - For structural checkpoint validation (optional)

The NestJS backend proxies the SSE stream from `/generate-checkpoints` to the frontend.

## Troubleshooting

### OPENAI_API_KEY not found

Make sure `.env` file exists and contains your API key:
```bash
OPENAI_API_KEY=sk-your-actual-key-here
```

### PDF extraction returns empty text

- The PDF may be scanned/image-based (no selectable text)
- Try OCR preprocessing if needed
- Check logs for warnings about empty pages

### LLM streaming fails

- Verify OpenAI API key is valid
- Check OpenAI API status
- Review logs for detailed error messages

### Port 8000 already in use

Change the port in `.env`:
```bash
PORT=8001
```

Or specify when running:
```powershell
uvicorn main:app --port 8001
```

## API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## License

MIT
