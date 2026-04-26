"""
Pydantic models for request/response validation.
"""
from typing import Literal, Optional
from pydantic import BaseModel, Field


class Message(BaseModel):
    """Conversation history message."""
    role: Literal["professor", "assistant"]
    content: str


class GenerateCheckpointsRequest(BaseModel):
    """Request body for /generate-checkpoints endpoint."""
    text: str = Field(..., description="Original exercise extracted text")
    current_checkpoints: str = Field(default="", description="Current checkpoint JSON as string")
    history: list[Message] = Field(default_factory=list, description="Conversation history")
    message: str = Field(..., description="Current professor message")


class CheckpointInfo(BaseModel):
    """Checkpoint data used for pattern generation."""
    order: int
    description: str
    current_pattern: str = Field(default="", description="Existing regex pattern, may be empty")


class GeneratePatternsRequest(BaseModel):
    """Request body for /generate-patterns endpoint."""
    checkpoints: list[CheckpointInfo] = Field(..., description="List of checkpoints to generate patterns for")
    extracted_text: str = Field(default="", description="Original exercise text for context")
    history: list[Message] = Field(default_factory=list, description="Pattern conversation history")
    message: str = Field(..., description="Current professor message")


class ExtractPdfResponse(BaseModel):
    """Response for /extract-pdf endpoint."""
    extracted_text: str


class SqlParseRequest(BaseModel):
    """Request body for /parse-sql endpoint."""
    sql_text: str = Field(..., description="SQL text to parse")


class TokenInfo(BaseModel):
    """Represents a parsed SQL token."""
    type: str
    value: str
    tokens: Optional[list["TokenInfo"]] = None


class SqlParseResponse(BaseModel):
    """Response for /parse-sql endpoint."""
    statements: list[list[TokenInfo]]
    success: bool = True
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str


# Grading models

class CheckpointPattern(BaseModel):
    """A single checkpoint with its regex pattern."""
    id: str
    pattern: str
    case_sensitive: bool = False


class FileContent(BaseModel):
    """A single extracted file with its content."""
    relative_path: str
    content: str


class GradeRequest(BaseModel):
    """Request body for /grade endpoint."""
    checkpoints: list[CheckpointPattern]
    files: list[FileContent]


class MatchedSnippet(BaseModel):
    file: str
    line: int
    snippet: str


class CheckpointResult(BaseModel):
    checkpoint_id: str
    matched: bool
    matched_snippets: list[MatchedSnippet]


class GradeResponse(BaseModel):
    """Response for /grade endpoint."""
    results: list[CheckpointResult]


# Mini report models

class CheckpointResultInfo(BaseModel):
    """Checkpoint result for mini report."""
    description: str
    matched: bool


class SubmissionSummary(BaseModel):
    """Summary of a single student submission for mini report."""
    exercise_title: str
    submitted_at: str
    total_checkpoints: int
    passed_checkpoints: int
    score: float
    teacher_score: Optional[float] = None
    checkpoint_results: list[CheckpointResultInfo] = Field(default_factory=list)


class MiniReportRequest(BaseModel):
    """Request body for /generate-mini-report endpoint."""
    student_name: str
    student_identifier: str
    submissions: list[SubmissionSummary]


class MiniReportResponse(BaseModel):
    """Response for /generate-mini-report endpoint."""
    report: str


# LLM grading models

class LlmCheckpointDesc(BaseModel):
    """Checkpoint description sent for LLM-based grading."""
    id: str
    description: str
    pattern: str = ""


class LlmGradeRequest(BaseModel):
    """Request body for /grade-llm endpoint."""
    checkpoints: list[LlmCheckpointDesc]
    files: list[FileContent]


class LlmMatchedSnippet(BaseModel):
    file: str
    line: int
    snippet: str


class LlmCheckpointResult(BaseModel):
    checkpoint_id: str
    matched: bool
    matched_snippets: list[LlmMatchedSnippet]


class LlmGradeResponse(BaseModel):
    """Response for /grade-llm endpoint."""
    results: list[LlmCheckpointResult]
