"""
Service for explaining why LLM-based checkpoint grading failed.
Uses OpenAI (via LangChain) to produce a one-sentence Greek explanation per failed checkpoint.
"""
import json
import logging
import os
import httpx
from fastapi import HTTPException
from openai import RateLimitError, APIError
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from models import ExplainLlmFailuresRequest, ExplainFailuresResponse, CheckpointExplanation
from prompts.explain_llm_failures_prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE
from services.llm_grading_service import _chunk_annotated_text

logger = logging.getLogger(__name__)


def _format_failed_checkpoints(checkpoints) -> str:
    lines = []
    for cp in checkpoints:
        lines.append(f'ID: {cp.id}')
        lines.append(f'Description: {cp.description}')
        lines.append('')
    return '\n'.join(lines)


async def explain_llm_failures(request: ExplainLlmFailuresRequest) -> ExplainFailuresResponse:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")

    checkpoints_text = _format_failed_checkpoints(request.checkpoints)
    file_chunks = _chunk_annotated_text(request.files)

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.2,
        api_key=api_key,
        model_kwargs={"response_format": {"type": "json_object"}},
        http_client=httpx.Client(),
        http_async_client=httpx.AsyncClient(),
    )

    logger.info(
        "Explaining %d failed LLM checkpoints across %d chunk(s)",
        len(request.checkpoints),
        len(file_chunks),
    )

    checkpoint_ids = [cp.id for cp in request.checkpoints]
    explanations: dict[str, str] = {}

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
        except json.JSONDecodeError as e:
            logger.error("Failed to parse LLM JSON on chunk %d/%d: %s\nRaw: %s", i + 1, len(file_chunks), e, response.content)
            raise HTTPException(status_code=500, detail="Το μοντέλο επέστρεψε μη έγκυρο JSON.")

        for r in result_json.get("results", []):
            cp_id = r.get("checkpoint_id")
            explanation = r.get("explanation", "").strip()
            if cp_id in checkpoint_ids and cp_id not in explanations and explanation:
                explanations[cp_id] = explanation

        logger.info("Chunk %d/%d explained", i + 1, len(file_chunks))

    results = [
        CheckpointExplanation(
            checkpoint_id=cp_id,
            explanation=explanations.get(cp_id, "Το μοντέλο δεν μπόρεσε να εντοπίσει αιτιολόγηση για αυτό το checkpoint."),
        )
        for cp_id in checkpoint_ids
    ]

    logger.info("Explanation complete: %d/%d checkpoints explained", len(explanations), len(checkpoint_ids))

    return ExplainFailuresResponse(results=results)
