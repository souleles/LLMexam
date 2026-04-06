"""
Regex-based grading service.
Uses Python's re module so LLM-generated patterns (including (?i) inline flags) work natively.
"""
import re
import logging
from models import GradeRequest, GradeResponse, CheckpointResult, MatchedSnippet

logger = logging.getLogger(__name__)


def grade_submission(request: GradeRequest) -> GradeResponse:
    logger.info(
        "Starting grading: %d checkpoints, %d files",
        len(request.checkpoints),
        len(request.files),
    )
    for f in request.files:
        line_count = f.content.count('\n') + 1
        logger.debug("File '%s': %d chars, ~%d lines", f.relative_path, len(f.content), line_count)

    results: list[CheckpointResult] = []

    for checkpoint in request.checkpoints:
        matched = False
        snippets: list[MatchedSnippet] = []

        pattern_str = checkpoint.pattern.strip()
        if not pattern_str:
            logger.warning("Checkpoint %s has an empty pattern — skipping", checkpoint.id)
            results.append(
                CheckpointResult(checkpoint_id=checkpoint.id, matched=False, matched_snippets=[])
            )
            continue

        try:
            flags = 0 if checkpoint.case_sensitive else re.IGNORECASE
            regex = re.compile(pattern_str, flags)
            logger.debug(
                "Checkpoint %s | pattern: %r | case_sensitive: %s",
                checkpoint.id,
                pattern_str,
                checkpoint.case_sensitive,
            )

            for f in request.files:
                file_matches = list(regex.finditer(f.content))
                if file_matches:
                    logger.debug(
                        "  File '%s': %d match(es) found", f.relative_path, len(file_matches)
                    )
                for m in file_matches:
                    matched = True
                    # Count newlines before match start to get 1-based line number
                    line_number = f.content[: m.start()].count('\n') + 1
                    # Show the full line where the match starts, not just the matched text
                    line_start = f.content.rfind('\n', 0, m.start()) + 1  # char after preceding \n
                    line_end = f.content.find('\n', m.start())
                    if line_end == -1:
                        line_end = len(f.content)
                    full_line = f.content[line_start:line_end].rstrip('\r').strip()
                    logger.debug(
                        "    Match at line %d (chars %d-%d): %r",
                        line_number, m.start(), m.end(), full_line[:120],
                    )
                    snippets.append(
                        MatchedSnippet(file=f.relative_path, line=line_number, snippet=full_line)
                    )

        except re.error as e:
            logger.warning(
                "Invalid regex pattern for checkpoint %s (%r): %s", checkpoint.id, pattern_str, e
            )

        logger.info(
            "Checkpoint %s: matched=%s, snippets=%d",
            checkpoint.id,
            matched,
            len(snippets),
        )
        results.append(
            CheckpointResult(checkpoint_id=checkpoint.id, matched=matched, matched_snippets=snippets)
        )

    passed = sum(1 for r in results if r.matched)
    logger.info("Grading complete: %d/%d checkpoints passed", passed, len(results))
    return GradeResponse(results=results)
