"""
LLM-based grading service.
Uses OpenAI (via LangChain) to semantically evaluate student code against checkpoint requirements.
"""
import json
import logging
import os
import httpx
from fastapi import HTTPException
from openai import RateLimitError, APIError
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from models import LlmGradeRequest, LlmGradeResponse, LlmCheckpointResult, LlmMatchedSnippet
from prompts.llm_grading_prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

MAX_CHUNK_CHARS = 80_000


def _annotate_single_file(f) -> str:
    lines = f.content.split('\n')
    annotated = '\n'.join(f'{i + 1:4d} | {line}' for i, line in enumerate(lines))
    return f'=== File: {f.relative_path} ===\n{annotated}'


def _annotate_files(files) -> str:
    return '\n\n'.join(_annotate_single_file(f) for f in files)


def _chunk_annotated_text(files, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    """Return list of annotated content strings, each under max_chars.

    Files that individually exceed max_chars are split by line groups.
    Multiple small files are packed into the same chunk greedily.
    """
    # Produce a flat list of annotated parts (one per file or per line-split segment)
    parts: list[str] = []
    for f in files:
        annotated = _annotate_single_file(f)
        if len(annotated) <= max_chars:
            parts.append(annotated)
        else:
            # Split the file into line-group segments that each fit in max_chars
            header = f'=== File: {f.relative_path} ==='
            raw_lines = f.content.split('\n')
            current_lines: list[str] = []
            current_size = len(header) + 1

            for i, line in enumerate(raw_lines):
                line_str = f'{i + 1:4d} | {line}'
                entry_size = len(line_str) + 1  # +1 for \n

                if current_size + entry_size > max_chars and current_lines:
                    parts.append(header + '\n' + '\n'.join(current_lines))
                    current_lines = []
                    current_size = len(header) + 1

                current_lines.append(line_str)
                current_size += entry_size

            if current_lines:
                parts.append(header + '\n' + '\n'.join(current_lines))

    # Greedily pack parts into chunks
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_chunk_size = 0

    for part in parts:
        part_size = len(part) + 4  # +4 for '\n\n' joiner
        if current_chunk_size + part_size > max_chars and current_chunk:
            chunks.append('\n\n'.join(current_chunk))
            current_chunk = []
            current_chunk_size = 0
        current_chunk.append(part)
        current_chunk_size += part_size

    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))

    return chunks or ['']


def _format_checkpoints(checkpoints) -> str:
    lines = []
    for cp in checkpoints:
        lines.append(f'ID: {cp.id}')
        lines.append(f'Description: {cp.description}')
        if cp.pattern:
            lines.append(f'Regex hint: {cp.pattern}')
        lines.append('')
    return '\n'.join(lines)


def _merge_chunk_results(
    all_chunk_results: list[list],
    checkpoint_ids: list[str],
) -> list[LlmCheckpointResult]:
    """Merge per-chunk results. A checkpoint is matched if matched in any chunk."""
    cp_matched: dict[str, bool] = {cp_id: False for cp_id in checkpoint_ids}
    cp_snippets: dict[str, list] = {cp_id: [] for cp_id in checkpoint_ids}

    for chunk_results in all_chunk_results:
        for r in chunk_results:
            cp_id = r.get("checkpoint_id")
            if cp_id not in cp_matched:
                continue
            if r.get("matched", False):
                cp_matched[cp_id] = True
                for s in r.get("matched_snippets", []):
                    if len(cp_snippets[cp_id]) < 3:
                        cp_snippets[cp_id].append(s)

    results = []
    for cp_id in checkpoint_ids:
        snippets = [
            LlmMatchedSnippet(
                file=s.get("file", ""),
                line=int(s.get("line", 0)),
                snippet=s.get("snippet", ""),
            )
            for s in cp_snippets[cp_id]
        ]
        results.append(LlmCheckpointResult(
            checkpoint_id=cp_id,
            matched=cp_matched[cp_id],
            matched_snippets=snippets,
        ))

    return results


async def grade_submission_with_llm(request: LlmGradeRequest) -> LlmGradeResponse:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")

    checkpoints_text = _format_checkpoints(request.checkpoints)
    file_chunks = _chunk_annotated_text(request.files)

    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        api_key=api_key,
        model_kwargs={"response_format": {"type": "json_object"}},
        http_client=httpx.Client(),
        http_async_client=httpx.AsyncClient(),
    )

    logger.info(
        "Starting LLM grading: %d checkpoints, %d files, %d chunk(s)",
        len(request.checkpoints),
        len(request.files),
        len(file_chunks),
    )

    all_chunk_results: list[list] = []

    for i, chunk in enumerate(file_chunks):
        user_prompt = USER_PROMPT_TEMPLATE.format(
            checkpoints_text=checkpoints_text,
            files_text=chunk,
        )

        try:
            response = await llm.ainvoke([
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ])
        except RateLimitError as e:
            logger.error("OpenAI rate limit exceeded on chunk %d/%d: %s", i + 1, len(file_chunks), e)
            raise HTTPException(
                status_code=429,
                detail="Υπέρβαση ορίου αιτημάτων OpenAI. Δοκιμάστε ξανά σε λίγο.",
            )
        except APIError as e:
            logger.error("OpenAI API error on chunk %d/%d: %s", i + 1, len(file_chunks), e)
            raise HTTPException(status_code=502, detail=f"Σφάλμα OpenAI API: {e.message}")
        except Exception as e:
            logger.error("Unexpected error on chunk %d/%d: %s", i + 1, len(file_chunks), e)
            raise HTTPException(status_code=500, detail="Αδυναμία επικοινωνίας με το μοντέλο γλώσσας.")

        try:
            result_json = json.loads(response.content)
            all_chunk_results.append(result_json.get("results", []))
        except json.JSONDecodeError as e:
            logger.error("Failed to parse LLM JSON on chunk %d/%d: %s\nRaw: %s", i + 1, len(file_chunks), e, response.content)
            raise HTTPException(status_code=500, detail="Το μοντέλο επέστρεψε μη έγκυρο JSON.")

        logger.info("Chunk %d/%d graded", i + 1, len(file_chunks))

    checkpoint_ids = [cp.id for cp in request.checkpoints]
    results = _merge_chunk_results(all_chunk_results, checkpoint_ids)

    passed = sum(1 for r in results if r.matched)
    logger.info(
        "LLM grading complete: %d/%d checkpoints matched across %d chunk(s)",
        passed, len(results), len(file_chunks),
    )

    return LlmGradeResponse(results=results)
