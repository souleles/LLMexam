"""
LLM service using LangChain for checkpoint extraction.
"""
import logging
import os
from typing import AsyncIterator
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from models import GenerateCheckpointsRequest
from prompts.checkpoint_prompts import (
    SYSTEM_PROMPT_INITIAL,
    USER_PROMPT_INITIAL,
    SYSTEM_PROMPT_REFINEMENT,
    USER_PROMPT_REFINEMENT,
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
        # Initial extraction
        messages.append(SystemMessage(content=SYSTEM_PROMPT_INITIAL))
        user_content = USER_PROMPT_INITIAL.format(extracted_text=request.text)
        messages.append(HumanMessage(content=user_content))
    else:
        # Refinement conversation
        system_content = SYSTEM_PROMPT_REFINEMENT.format(
            current_checkpoints=request.current_checkpoints or "[]"
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
        # Get OpenAI API key from environment
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment")
        
        # Initialize LLM with streaming
        llm = ChatOpenAI(
            model="gpt-4o",
            streaming=True,
            temperature=0.3,  # Lower temperature for more consistent structured output
            api_key=api_key,
        )
        
        # Build message list
        messages = build_messages(request)
        
        logger.info("Starting LLM stream...")
        
        # Stream tokens
        async for chunk in llm.astream(messages):
            token = chunk.content
            if token:
                # Send as SSE format
                yield f"data: {token}\n\n"
        
        # Send completion signal
        yield "data: [DONE]\n\n"
        logger.info("LLM stream completed")
        
    except Exception as e:
        logger.error(f"LLM streaming failed: {str(e)}")
        # Send error as SSE
        yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
        yield "data: [DONE]\n\n"
