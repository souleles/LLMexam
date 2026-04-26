"""
LLM-based grading service.
Uses OpenAI (via LangChain) to semantically evaluate student code against checkpoint requirements.
"""
import json
import logging
import os
import httpx
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from models import LlmGradeRequest, LlmGradeResponse, LlmCheckpointResult, LlmMatchedSnippet

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert code grader for a university exam. Analyze student code submissions and determine whether each requirement (checkpoint) is satisfied.

For each checkpoint you receive:
- An ID (use this exactly in your response)
- A description of the requirement
- An optional regex hint (for reference only — do NOT apply it mechanically)

For each checkpoint determine:
1. Is the requirement satisfied in the code? (matched: true/false)
2. If matched, the file name, line number, and exact line text where the requirement is first satisfied.

Rules:
- Base your judgment on the DESCRIPTION, not the regex
- Line numbers are shown as "  42 | code here" — use the number before the pipe
- Provide at most 3 snippets per checkpoint (the most relevant ones)

Respond with ONLY valid JSON, no explanation. Format:
{
  "results": [
    {
      "checkpoint_id": "<exact id>",
      "matched": true,
      "matched_snippets": [
        {"file": "filename.sql", "line": 42, "snippet": "the exact line text"}
      ]
    },
    {
      "checkpoint_id": "<exact id>",
      "matched": false,
      "matched_snippets": []
    }
  ]
}"""


def _annotate_files(files) -> str:
    parts = []
    for f in files:
        lines = f.content.split('\n')
        annotated = '\n'.join(f'{i + 1:4d} | {line}' for i, line in enumerate(lines))
        parts.append(f'=== File: {f.relative_path} ===\n{annotated}')
    return '\n\n'.join(parts)


def _format_checkpoints(checkpoints) -> str:
    lines = []
    for cp in checkpoints:
        lines.append(f'ID: {cp.id}')
        lines.append(f'Description: {cp.description}')
        if cp.pattern:
            lines.append(f'Regex hint: {cp.pattern}')
        lines.append('')
    return '\n'.join(lines)


async def grade_submission_with_llm(request: LlmGradeRequest) -> LlmGradeResponse:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")

    files_text = _annotate_files(request.files)
    checkpoints_text = _format_checkpoints(request.checkpoints)

    user_prompt = (
        f"Checkpoints to evaluate:\n\n{checkpoints_text}\n"
        f"Source code files:\n\n{files_text}\n\n"
        "Evaluate each checkpoint and respond with JSON only."
    )

    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        api_key=api_key,
        model_kwargs={"response_format": {"type": "json_object"}},
        http_client=httpx.Client(),
        http_async_client=httpx.AsyncClient(),
    )

    logger.info(
        "Starting LLM grading: %d checkpoints, %d files",
        len(request.checkpoints),
        len(request.files),
    )

    response = await llm.ainvoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ])

    result_json = json.loads(response.content)
    logger.info("LLM grading response received, parsing results...")

    results: list[LlmCheckpointResult] = []
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
            LlmCheckpointResult(
                checkpoint_id=r["checkpoint_id"],
                matched=bool(r.get("matched", False)),
                matched_snippets=snippets,
            )
        )

    passed = sum(1 for r in results if r.matched)
    logger.info("LLM grading complete: %d/%d checkpoints matched", passed, len(results))

    return LlmGradeResponse(results=results)
