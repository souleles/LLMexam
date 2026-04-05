"""
Regex-based grading service.
Uses Python's re module so LLM-generated patterns (including (?i) inline flags) work natively.
"""
import re
import logging
from models import GradeRequest, GradeResponse, CheckpointResult, MatchedSnippet

logger = logging.getLogger(__name__)


def grade_submission(request: GradeRequest) -> GradeResponse:
    results: list[CheckpointResult] = []

    for checkpoint in request.checkpoints:
        matched = False
        snippets: list[MatchedSnippet] = []

        if checkpoint.pattern.strip():
            try:
                flags = 0 if checkpoint.case_sensitive else re.IGNORECASE
                regex = re.compile(checkpoint.pattern, flags)

                for f in request.files:
                    for m in regex.finditer(f.content):
                        matched = True
                        line_number = f.content[: m.start()].count('\n') + 1
                        snippet = m.group(0).split('\n')[0].strip()
                        snippets.append(
                            MatchedSnippet(file=f.relative_path, line=line_number, snippet=snippet)
                        )
            except re.error as e:
                logger.warning(f"Invalid regex pattern for checkpoint {checkpoint.id}: {e}")

        results.append(
            CheckpointResult(checkpoint_id=checkpoint.id, matched=matched, matched_snippets=snippets)
        )

    return GradeResponse(results=results)
