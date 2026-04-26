"""
FastAPI main application for ExamChecker Python microservice.
"""
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

from models import (
    GenerateCheckpointsRequest,
    GeneratePatternsRequest,
    ExtractPdfResponse,
    SqlParseRequest,
    SqlParseResponse,
    HealthResponse,
    GradeRequest,
    GradeResponse,
    MiniReportRequest,
    MiniReportResponse,
    LlmGradeRequest,
    LlmGradeResponse,
)
from services.pdf_service import extract_text_from_pdf
from services.llm_service import stream_checkpoint_generation, stream_pattern_generation, generate_mini_report
from services.sql_service import parse_sql
from services.grading_service import grade_submission
from services.llm_grading_service import grade_submission_with_llm

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    logger.info("Starting ExamChecker Python microservice...")
    
    # Validate required environment variables
    if not os.getenv("OPENAI_API_KEY"):
        logger.warning("OPENAI_API_KEY not set - LLM features will fail")
    
    yield
    
    # Shutdown
    logger.info("Shutting down ExamChecker Python microservice...")


# Create FastAPI app
app = FastAPI(
    title="ExamChecker Python Microservice",
    description="PDF extraction, LLM checkpoint generation, and SQL parsing",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration - allow NestJS backend to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],  # NestJS backend and frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="ok", version="1.0.0")


@app.post("/extract-pdf", response_model=ExtractPdfResponse)
async def extract_pdf(file: UploadFile = File(...)):
    """
    Extract text from uploaded PDF file.
    
    Args:
        file: PDF file uploaded as multipart/form-data
        
    Returns:
        ExtractPdfResponse with extracted text
    """
    logger.info(f"Received PDF extraction request: {file.filename}")

    # Validate file type — use content_type as primary check so Greek/non-ASCII
    # filenames (where file.filename may be None or garbled) still work correctly
    filename = file.filename or ""
    is_pdf_by_name = filename.lower().endswith('.pdf')
    is_pdf_by_type = (file.content_type or "").lower() in ("application/pdf", "application/x-pdf")
    if not is_pdf_by_name and not is_pdf_by_type:
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    # Extract text
    extracted_text = await extract_text_from_pdf(file)
    
    return ExtractPdfResponse(extracted_text=extracted_text)


@app.post("/generate-checkpoints")
async def generate_checkpoints(request: GenerateCheckpointsRequest):
    """
    Generate grading checkpoints from exercise text using LLM.
    Streams response via Server-Sent Events (SSE).
    
    Args:
        request: GenerateCheckpointsRequest with exercise text and conversation history
        
    Returns:
        StreamingResponse with SSE-formatted LLM tokens
    """
    logger.info("Received checkpoint generation request")
    
    # Stream LLM response as SSE
    return StreamingResponse(
        stream_checkpoint_generation(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@app.post("/generate-patterns")
async def generate_patterns(request: GeneratePatternsRequest):
    """
    Generate regex patterns for grading checkpoints using LLM.
    Streams response via Server-Sent Events (SSE).
    """
    logger.info("Received pattern generation request")

    return StreamingResponse(
        stream_pattern_generation(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/grade", response_model=GradeResponse)
async def grade(request: GradeRequest):
    """
    Grade student submission files against checkpoint regex patterns.
    Uses Python's re module — supports (?i) inline flags and full PCRE syntax.
    """
    logger.info(f"Received grading request: {len(request.checkpoints)} checkpoints, {len(request.files)} files")
    return grade_submission(request)


@app.post("/grade-llm", response_model=LlmGradeResponse)
async def grade_llm(request: LlmGradeRequest):
    """
    Grade student submission files against checkpoint requirements using LLM semantic analysis.
    Results include file name, line number, and snippet for each matched checkpoint.
    """
    logger.info(f"Received LLM grading request: {len(request.checkpoints)} checkpoints, {len(request.files)} files")
    return await grade_submission_with_llm(request)


@app.post("/generate-mini-report", response_model=MiniReportResponse)
async def generate_mini_report_endpoint(request: MiniReportRequest):
    """
    Generate a mini performance report for a student using LLM.
    Returns a plain-text Greek report about the student's grades and history.
    """
    logger.info(f"Received mini report request for student {request.student_identifier}")
    report_text = await generate_mini_report(request)
    return MiniReportResponse(report=report_text)


@app.post("/parse-sql", response_model=SqlParseResponse)
async def parse_sql_endpoint(request: SqlParseRequest):
    """
    Parse SQL text into token tree structure.
    
    Args:
        request: SqlParseRequest with SQL text
        
    Returns:
        SqlParseResponse with parsed token tree
    """
    logger.info("Received SQL parsing request")
    
    statements, success, error = parse_sql(request.sql_text)
    
    return SqlParseResponse(
        statements=statements,
        success=success,
        error=error,
    )


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8000"))
    
    logger.info(f"Starting server on port {port}...")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENVIRONMENT") == "development",
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )
