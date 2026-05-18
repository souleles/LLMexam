"""
Project grading service.
The LLM reads the exercise text, discovers the questions/tasks inside it,
then grades whether the student submission addresses each one.
No pre-defined checkpoints are needed — the LLM builds them from the PDF.
"""
import json
import logging
import os
import httpx
from fastapi import HTTPException
from openai import RateLimitError, APIError
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from models import ProjectGradeRequest, ProjectGradeResponse, ProjectQuestionResult, LlmMatchedSnippet, ProjectReportRequest
from prompts.project_grading_prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE
from prompts.project_report_prompts import SYSTEM_PROMPT_PROJECT_REPORT, USER_PROMPT_PROJECT_REPORT

logger = logging.getLogger(__name__)

# gpt-4o-mini has much higher TPM limits on lower-tier accounts.
# 30 000 chars ≈ 7 500 tokens, leaving ample room for the system prompt,
# exercise text, and the JSON response within a 30 000 TPM limit.
_MAX_FILE_CHARS = 30_000


def _annotate_files(files) -> str:
    parts = []
    for f in files:
        lines = f.content.split('\n')
        annotated = '\n'.join(f'{i + 1:4d} | {line}' for i, line in enumerate(lines))
        parts.append(f'=== File: {f.relative_path} ===\n{annotated}')
    return '\n\n'.join(parts)


def _truncate_files_text(files_text: str) -> str:
    if len(files_text) <= _MAX_FILE_CHARS:
        return files_text
    truncated = files_text[:_MAX_FILE_CHARS]
    cut_line = truncated.rfind('\n')
    if cut_line > 0:
        truncated = truncated[:cut_line]
    truncated += '\n\n[... Το υπόλοιπο περιεχόμενο αποκόπηκε λόγω ορίου μεγέθους ...]'
    logger.warning(
        "File content truncated from %d to %d chars to stay within token limit",
        len(files_text),
        len(truncated),
    )
    return truncated


async def grade_project_with_llm(request: ProjectGradeRequest) -> ProjectGradeResponse:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")

    files_text = _truncate_files_text(_annotate_files(request.files))

    user_prompt = USER_PROMPT_TEMPLATE.format(
        exercise_text=request.exercise_text,
        files_text=files_text,
    )

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0,
        api_key=api_key,
        model_kwargs={"response_format": {"type": "json_object"}},
        http_client=httpx.Client(),
        http_async_client=httpx.AsyncClient(),
    )

    logger.info(
        "Starting project LLM grading: %d files, exercise text length=%d",
        len(request.files),
        len(request.exercise_text),
    )

    try:
        response = await llm.ainvoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ])
    except RateLimitError as e:
        logger.error("OpenAI rate limit exceeded: %s", e)
        raise HTTPException(
            status_code=429,
            detail="Υπέρβαση ορίου αιτημάτων OpenAI. Δοκιμάστε ξανά σε λίγο.",
        )
    except APIError as e:
        logger.error("OpenAI API error during project grading: %s", e)
        raise HTTPException(status_code=502, detail=f"Σφάλμα OpenAI API: {e.message}")
    except Exception as e:
        logger.error("Unexpected error during project LLM grading: %s", e)
        raise HTTPException(status_code=500, detail="Αδυναμία επικοινωνίας με το μοντέλο γλώσσας.")

    try:
        result_json = json.loads(response.content)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse LLM JSON response: %s\nRaw: %s", e, response.content)
        raise HTTPException(status_code=500, detail="Το μοντέλο επέστρεψε μη έγκυρο JSON.")

    logger.info("Project LLM grading response received, parsing results...")

    results: list[ProjectQuestionResult] = []
    for r in result_json.get("results", []):
        snippets = [
            LlmMatchedSnippet(
                file=s.get("file", ""),
                line=int(s.get("line", 0)),
                snippet=s.get("snippet", ""),
            )
            for s in r.get("matched_snippets", [])
        ]
        results.append(
            ProjectQuestionResult(
                question_id=r["question_id"],
                description=r.get("description", r["question_id"]),
                matched=bool(r.get("matched", False)),
                matched_snippets=snippets,
            )
        )

    passed = sum(1 for r in results if r.matched)
    logger.info("Project grading complete: %d/%d questions matched", passed, len(results))

    return ProjectGradeResponse(results=results)


async def generate_project_report(request: ProjectReportRequest) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")

    questions_lines = []
    for q in request.questions:
        mark = "✓" if q.get("matched") else "✗"
        questions_lines.append(f"{mark} {q.get('description', '')}")
    questions_text = "\n".join(questions_lines)

    user_prompt = USER_PROMPT_PROJECT_REPORT.format(
        exercise_title=request.exercise_title or "Project",
        questions_text=questions_text,
    )

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.3,
        api_key=api_key,
        http_client=httpx.Client(),
        http_async_client=httpx.AsyncClient(),
    )

    logger.info("Generating project report for %d questions", len(request.questions))

    try:
        response = await llm.ainvoke([
            SystemMessage(content=SYSTEM_PROMPT_PROJECT_REPORT),
            HumanMessage(content=user_prompt),
        ])
    except RateLimitError as e:
        logger.error("OpenAI rate limit exceeded during project report: %s", e)
        raise HTTPException(status_code=429, detail="Υπέρβαση ορίου αιτημάτων OpenAI.")
    except APIError as e:
        logger.error("OpenAI API error during project report: %s", e)
        raise HTTPException(status_code=502, detail=f"Σφάλμα OpenAI API: {e.message}")
    except Exception as e:
        logger.error("Unexpected error during project report generation: %s", e)
        raise HTTPException(status_code=500, detail="Αδυναμία δημιουργίας αναφοράς.")

    return response.content.strip()
