"""
LLM service using LangChain for checkpoint extraction and pattern generation.
"""
import json
import logging
import os
from typing import AsyncIterator
import httpx
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from models import GenerateCheckpointsRequest, GeneratePatternsRequest, MiniReportRequest
from prompts.checkpoint_prompts import (
    SYSTEM_PROMPT_INITIAL,
    USER_PROMPT_INITIAL,
    SYSTEM_PROMPT_REFINEMENT,
    USER_PROMPT_REFINEMENT,
)
from prompts.patterns_prompts import (
    SYSTEM_PROMPT_PATTERNS,
    USER_PROMPT_PATTERNS,
    SYSTEM_PROMPT_INDICATOR_SOLUTIONS,
    USER_PROMPT_INDICATOR_SOLUTIONS,
)
from prompts.mini_report_prompts import (
    SYSTEM_PROMPT_MINI_REPORT,
    USER_PROMPT_MINI_REPORT,
)

logger = logging.getLogger(__name__)


def build_messages(request: GenerateCheckpointsRequest) -> list[SystemMessage | HumanMessage | AIMessage]:
    """
    Build LangChain message list for checkpoint generation.
    
    Args:
        request: Request containing exercise text, history, and current message
        
    Returns:
        List of LangChain messages
    """
    messages = []
    
    # Determine if this is initial extraction or refinement
    is_initial = len(request.history) == 0 and not request.current_checkpoints
    
    if is_initial:
        # Initial extraction — include user message so professor can guide extraction
        messages.append(SystemMessage(content=SYSTEM_PROMPT_INITIAL))
        user_content = USER_PROMPT_INITIAL.format(
            extracted_text=request.text,
            message=request.message,
        )
        messages.append(HumanMessage(content=user_content))
    else:
        # Refinement conversation
        system_content = SYSTEM_PROMPT_REFINEMENT.format(
            current_checkpoints=request.current_checkpoints or "[]",
            extracted_text=request.text,
        )
        messages.append(SystemMessage(content=system_content))
        
        # Add last 6 messages from history (3 professor + 3 assistant)
        history_to_include = request.history[-6:] if len(request.history) > 6 else request.history
        for msg in history_to_include:
            if msg.role == "professor":
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))
        
        # Add current message
        user_content = USER_PROMPT_REFINEMENT.format(
            extracted_text=request.text,
            message=request.message
        )
        messages.append(HumanMessage(content=user_content))
    
    logger.info(f"Built {len(messages)} messages for LLM (initial={is_initial})")
    return messages


async def stream_checkpoint_generation(request: GenerateCheckpointsRequest) -> AsyncIterator[str]:
    """
    Stream LLM responses for checkpoint generation using SSE format.
    
    Args:
        request: Request containing exercise text and conversation
        
    Yields:
        SSE-formatted strings: "data: {token}\n\n"
    """
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment")

        llm = ChatOpenAI(
            model="gpt-4o",
            streaming=True,
            temperature=0.3,
            api_key=api_key,
            http_client=httpx.Client(),
            http_async_client=httpx.AsyncClient(),
        )

        messages = build_messages(request)
        logger.info("Starting LLM call...")

        # Accumulate the full response (LLM returns JSON)
        full_response = ""
        async for chunk in llm.astream(messages):
            if chunk.content:
                full_response += chunk.content

        logger.info(f"LLM call completed. full_response length={len(full_response)} first200={repr(full_response[:200])}")

        # Extract JSON array from the response (model may add text/fences around it)
        cleaned = full_response.strip()
        # Try to find a ```...``` fence first
        if "```" in cleaned:
            fenced = cleaned.split("```", 1)[1]          # drop text before first fence
            fenced = fenced.split("```", 1)[0]           # drop text after closing fence
            fenced = fenced.lstrip("json").strip()       # strip optional language tag
            cleaned = fenced
        # Fall back to slicing from first '[' to last ']'
        if not cleaned.startswith("["):
            start = cleaned.find("[")
            end = cleaned.rfind("]")
            if start != -1 and end != -1:
                cleaned = cleaned[start:end + 1]

        raw_checkpoints = json.loads(cleaned)

        # Normalize LLM output to DB schema:
        # LLM: patterns[], order_index, case_sensitive
        # DB:  pattern (string), order, caseSensitive
        normalized = []
        for i, cp in enumerate(raw_checkpoints):
            patterns = cp.get("patterns", [])
            pattern = "|".join(patterns) if patterns else cp.get("pattern", "")
            normalized.append({
                "order": cp.get("order_index", cp.get("order", i + 1)),
                "description": cp.get("description", ""),
                "pattern": pattern,
                "patternDescription": cp.get("patternDescription", ""),
                "caseSensitive": cp.get("case_sensitive", cp.get("caseSensitive", False)),
            })

        count = len(normalized)
        logger.info(f"Parsed {count} checkpoints")

        # Send human-readable message for the chat UI
        yield f"data: Εξήχθησαν {count} checkpoints από την άσκηση.\n\n"

        # Send structured checkpoints event for the frontend to save
        yield f"data: {json.dumps({'type': 'checkpoints', 'data': normalized})}\n\n"

        yield "data: [DONE]\n\n"

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON response: {e}", exc_info=True)
        yield f"data: Σφάλμα: η απάντηση δεν ήταν έγκυρο JSON.\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.error(f"LLM streaming failed: {str(e)}", exc_info=True)
        yield f"data: Σφάλμα κατά την εξαγωγή checkpoints: {str(e)}\n\n"
        yield "data: [DONE]\n\n"


def _build_pattern_messages(request: GeneratePatternsRequest) -> list:
    """Build LangChain messages for pattern generation."""
    messages = []
    is_initial = len(request.history) == 0

    checkpoints_json = json.dumps(
        [{"order": cp.order, "description": cp.description, "current_pattern": cp.current_pattern} for cp in request.checkpoints],
        ensure_ascii=False,
        indent=2,
    )

    messages.append(SystemMessage(content=SYSTEM_PROMPT_PATTERNS))

    if not is_initial:
        history_to_include = request.history[-6:] if len(request.history) > 6 else request.history
        for msg in history_to_include:
            if msg.role == "professor":
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))

    user_content = USER_PROMPT_PATTERNS.format(
        checkpoints=checkpoints_json,
        extracted_text=request.extracted_text,
        message=request.message,
    )
    messages.append(HumanMessage(content=user_content))

    logger.info(f"Built {len(messages)} messages for pattern generation (initial={is_initial})")
    return messages


async def _generate_indicator_solutions(patterns: list[dict], extracted_text: str, api_key: str) -> list[dict]:
    """Second LLM call: generate indicatorSolution for each pattern independently."""
    llm = ChatOpenAI(
        model="gpt-4o",
        streaming=False,
        temperature=0.2,
        api_key=api_key,
        http_client=httpx.Client(),
        http_async_client=httpx.AsyncClient(),
    )

    checkpoints_json = json.dumps(
        [{"order": p["order"], "description": p["description"], "pattern": p["pattern"]} for p in patterns],
        ensure_ascii=False,
        indent=2,
    )

    messages = [
        SystemMessage(content=SYSTEM_PROMPT_INDICATOR_SOLUTIONS),
        HumanMessage(content=USER_PROMPT_INDICATOR_SOLUTIONS.format(
            extracted_text=extracted_text,
            patterns=checkpoints_json,
        )),
    ]

    logger.info("Starting indicator solutions LLM call (gpt-4o-mini)...")
    response = await llm.ainvoke(messages)

    cleaned = response.content.strip()
    if "```" in cleaned:
        fenced = cleaned.split("```", 1)[1]
        fenced = fenced.split("```", 1)[0]
        cleaned = fenced.lstrip("json").strip()
    if not cleaned.startswith("["):
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start != -1 and end != -1:
            cleaned = cleaned[start:end + 1]

    results = json.loads(cleaned)
    logger.info(f"Parsed {len(results)} indicator solutions")
    return results


async def stream_pattern_generation(request: GeneratePatternsRequest) -> AsyncIterator[str]:
    """
    Stream LLM responses for regex pattern generation using SSE format.

    Yields:
        SSE-formatted strings: "data: {token}\\n\\n"
    """
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment")

        llm = ChatOpenAI(
            model="gpt-4o",
            streaming=True,
            temperature=0.2,
            api_key=api_key,
            http_client=httpx.Client(),
            http_async_client=httpx.AsyncClient(),
        )

        messages = _build_pattern_messages(request)
        logger.info("Starting pattern generation LLM call...")

        full_response = ""
        async for chunk in llm.astream(messages):
            if chunk.content:
                full_response += chunk.content

        logger.info(f"Pattern LLM call completed. length={len(full_response)}")

        # Extract JSON array
        cleaned = full_response.strip()
        if "```" in cleaned:
            fenced = cleaned.split("```", 1)[1]
            fenced = fenced.split("```", 1)[0]
            fenced = fenced.lstrip("json").strip()
            cleaned = fenced
        if not cleaned.startswith("["):
            start = cleaned.find("[")
            end = cleaned.rfind("]")
            if start != -1 and end != -1:
                cleaned = cleaned[start:end + 1]

        raw_patterns = json.loads(cleaned)

        normalized = []
        for i, item in enumerate(raw_patterns):
            normalized.append({
                "order": item.get("order", i + 1),
                "pattern": item.get("pattern", ""),
                "description": item.get("description", ""),
                "patternDescription": item.get("patternDescription", ""),
                "indicatorSolution": "",
            })

        count = len(normalized)
        logger.info(f"Parsed {count} patterns")

        # Request 2: indicator solutions via a focused gpt-4o-mini call
        try:
            solutions = await _generate_indicator_solutions(normalized, request.extracted_text, api_key)
            solutions_map = {s["order"]: s.get("indicatorSolution", "") for s in solutions}
            for item in normalized:
                item["indicatorSolution"] = solutions_map.get(item["order"], "")
        except Exception as e:
            logger.warning(f"Indicator solutions generation failed, continuing without: {e}")

        yield f"data: Δημιουργήθηκαν {count} regex patterns.\n\n"
        yield f"data: {json.dumps({'type': 'patterns', 'data': normalized})}\n\n"
        yield "data: [DONE]\n\n"

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse pattern JSON response: {e}", exc_info=True)
        yield f"data: Σφάλμα: η απάντηση δεν ήταν έγκυρο JSON.\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.error(f"Pattern generation failed: {str(e)}", exc_info=True)
        yield f"data: Σφάλμα κατά τη δημιουργία patterns: {str(e)}\n\n"
        yield "data: [DONE]\n\n"


async def generate_mini_report(request: MiniReportRequest) -> str:
    """
    Generate a mini performance report for a student using LLM.

    Args:
        request: Student info and submission history

    Returns:
        Report text in Greek
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")

    llm = ChatOpenAI(
        model="gpt-4o",
        streaming=False,
        temperature=0.5,
        api_key=api_key,
        http_client=httpx.Client(),
        http_async_client=httpx.AsyncClient(),
    )

    # Build human-readable submissions text
    if not request.submissions:
        submissions_text = "Δεν υπάρχουν υποβολές."
    else:
        lines = []
        for i, sub in enumerate(request.submissions, 1):
            if sub.teacher_score is not None:
                score_str = f"Βαθμός καθηγητή: {sub.teacher_score}/{sub.total_checkpoints}"
            else:
                score_str = f"Αυτόματος βαθμός: {sub.passed_checkpoints}/{sub.total_checkpoints} ({sub.score:.0f}%)"
            lines.append(f"{i}. Εργασία: {sub.exercise_title} | Ημερομηνία: {sub.submitted_at} | {score_str}")
            for cp in sub.checkpoint_results:
                status = "Επιτυχία" if cp.matched else "Αποτυχία"
                lines.append(f"   - {cp.description}: {status}")
        submissions_text = "\n".join(lines)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT_MINI_REPORT),
        HumanMessage(content=USER_PROMPT_MINI_REPORT.format(
            student_name=request.student_name,
            student_identifier=request.student_identifier,
            submissions_text=submissions_text,
        )),
    ]

    logger.info(f"Generating mini report for student {request.student_identifier}")
    response = await llm.ainvoke(messages)
    logger.info(f"Mini report generated, length={len(response.content)}")
    return response.content
