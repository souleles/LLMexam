"""
Tests for the explain-regex-failures service.
"""
from models import ExplainFailureCheckpoint


def test_format_failed_checkpoints_includes_pattern():
    from services.explain_failures_service import _format_failed_checkpoints

    checkpoints = [
        ExplainFailureCheckpoint(
            id="cp-1",
            description="Δημιουργία πίνακα Students",
            pattern=r"CREATE\s+TABLE\s+Students",
            case_sensitive=False,
        ),
    ]

    text = _format_failed_checkpoints(checkpoints)

    assert "cp-1" in text
    assert "Δημιουργία πίνακα Students" in text
    assert r"CREATE\s+TABLE\s+Students" in text


def test_format_failed_checkpoints_handles_multiple():
    from services.explain_failures_service import _format_failed_checkpoints

    checkpoints = [
        ExplainFailureCheckpoint(id="cp-1", description="First", pattern="foo"),
        ExplainFailureCheckpoint(id="cp-2", description="Second", pattern="bar"),
    ]

    text = _format_failed_checkpoints(checkpoints)

    assert "cp-1" in text
    assert "cp-2" in text
    assert text.index("cp-1") < text.index("cp-2")
