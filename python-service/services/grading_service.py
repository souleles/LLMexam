"""
Regex-based grading service.
Uses Python's re module so LLM-generated patterns (including (?i) inline flags) work natively.
"""
import re
import logging
from models import GradeRequest, GradeResponse, CheckpointResult, MatchedSnippet

logger = logging.getLogger(__name__)

# Splits SQL files into logical blocks (procedure, trigger, function, event) so
# that a regex with [\s\S]*? cannot jump from one block into another.
_BLOCK_BOUNDARY = re.compile(
    r'(?:CREATE\s+(?:DEFINER\s*=\s*\S+\s+)?(?:PROCEDURE|TRIGGER|FUNCTION|EVENT))',
    re.IGNORECASE,
)


def _split_into_blocks(content: str) -> list[tuple[int, str]]:
    """
    Return a list of (start_line_1based, block_text) tuples.
    If the file has no SQL block headers the whole file is returned as one block.
    """
    boundaries = [m.start() for m in _BLOCK_BOUNDARY.finditer(content)]
    if not boundaries:
        return [(1, content)]

    blocks: list[tuple[int, str]] = []
    # Text before the first block (DROP statements, comments, etc.)
    if boundaries[0] > 0:
        preamble = content[: boundaries[0]]
        blocks.append((1, preamble))

    for i, start in enumerate(boundaries):
        end = boundaries[i + 1] if i + 1 < len(boundaries) else len(content)
        block_text = content[start:end]
        start_line = content[:start].count('\n') + 1
        blocks.append((start_line, block_text))

    logger.debug("Split file into %d block(s)", len(blocks))
    return blocks


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
                ext = f.relative_path.rsplit('.', 1)[-1].lower()
                # Split SQL files into per-block sections so [\s\S]*? patterns
                # cannot span from one CREATE PROCEDURE/TRIGGER into another.
                blocks = _split_into_blocks(f.content) if ext == 'sql' else [(1, f.content)]

                for block_start_line, block_text in blocks:
                    block_matches = list(regex.finditer(block_text))
                    if block_matches:
                        logger.debug(
                            "  File '%s' block@line%d: %d match(es) found",
                            f.relative_path, block_start_line, len(block_matches),
                        )
                    for m in block_matches:
                        matched = True
                        # Line within the block + offset of where the block starts in the file
                        line_in_block = block_text[: m.start()].count('\n')
                        line_number = block_start_line + line_in_block
                        # Full line where the match starts
                        line_start = block_text.rfind('\n', 0, m.start()) + 1
                        line_end = block_text.find('\n', m.start())
                        if line_end == -1:
                            line_end = len(block_text)
                        full_line = block_text[line_start:line_end].rstrip('\r').strip()
                        logger.debug(
                            "    Match at line %d (block-offset %d, chars %d-%d): %r",
                            line_number, line_in_block, m.start(), m.end(), full_line[:120],
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
