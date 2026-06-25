"""
Tests for LLM service.
"""
import pytest
from models import GenerateCheckpointsRequest, Message


def test_build_messages_initial():
    """Test message building for initial extraction."""
    from services.llm_service import build_messages
    
    request = GenerateCheckpointsRequest(
        text="Exercise: Write a SQL query...",
        current_checkpoints="",
        history=[],
        message="Extract checkpoints"
    )
    
    messages = build_messages(request)
    
    # Should have system message + user message
    assert len(messages) >= 2
    assert messages[0].type == "system"


def test_build_messages_refinement():
    """Test message building for refinement conversation."""
    from services.llm_service import build_messages
    
    request = GenerateCheckpointsRequest(
        text="Exercise: Write a SQL query...",
        current_checkpoints='[{"description": "test"}]',
        history=[
            Message(role="professor", content="Add more checkpoints"),
            Message(role="assistant", content="Here are the updated checkpoints...")
        ],
        message="Make the patterns stricter"
    )
    
    messages = build_messages(request)
    
    # Should include system, history, and current message
    assert len(messages) >= 4


def test_build_messages_with_long_history():
    """Test that history is trimmed to last 6 messages."""
    from services.llm_service import build_messages
    
    # Create 10 history messages
    history = []
    for i in range(10):
        role = "professor" if i % 2 == 0 else "assistant"
        history.append(Message(role=role, content=f"Message {i}"))
    
    request = GenerateCheckpointsRequest(
        text="Exercise text",
        current_checkpoints="[]",
        history=history,
        message="Current message"
    )
    
    messages = build_messages(request)
    
    # Should trim to last 6 history messages + system + current
    # System(1) + Last6History(6) + Current(1) = 8 messages
    assert len(messages) == 8


@pytest.mark.asyncio
async def test_stream_checkpoint_generation():
    """Test LLM streaming (requires API key)."""
    # This would need a real OpenAI API key for integration testing
    # For now, this is a placeholder structure
    pass


def test_build_rules_text_empty():
    from services.llm_service import build_rules_text

    assert build_rules_text([]) == ""


def test_build_rules_text_with_rules():
    from services.llm_service import build_rules_text

    result = build_rules_text(["Όλα τα ονόματα στα Αγγλικά", "Χρήση snake_case"])

    assert result == "Λάβε υπόψην του εξής κανόνες: Όλα τα ονόματα στα Αγγλικά, Χρήση snake_case\n\n"


def test_build_schema_text_empty():
    from services.llm_service import build_schema_text

    assert build_schema_text(None) == ""
    assert build_schema_text("") == ""


def test_build_schema_text_with_schema():
    from services.llm_service import build_schema_text

    result = build_schema_text("CREATE TABLE students (id INT);")

    assert result == "Σχήμα βάσης δεδομένων:\nCREATE TABLE students (id INT);\n\n"
