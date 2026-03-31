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
