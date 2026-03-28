"""
PDF extraction service using pdfplumber.
"""
import io
import logging
import pdfplumber
from fastapi import UploadFile, HTTPException

logger = logging.getLogger(__name__)


async def extract_text_from_pdf(file: UploadFile) -> str:
    """
    Extract text from uploaded PDF file.
    
    Args:
        file: Uploaded PDF file
        
    Returns:
        Extracted text string
        
    Raises:
        HTTPException: If PDF extraction fails
    """
    try:
        # Read file contents
        contents = await file.read()
        
        # Extract text using pdfplumber
        text_parts = []
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f"--- Page {page_num} ---\n{page_text}")
                else:
                    logger.warning(f"Page {page_num} returned empty text (possibly scanned/image-based)")
        
        # Join all pages
        full_text = "\n\n".join(text_parts)
        
        if not full_text.strip():
            logger.warning("PDF extraction resulted in empty text - may be scanned/image-based")
            return ""
        
        logger.info(f"Successfully extracted {len(full_text)} characters from PDF")
        return full_text.strip()
        
    except Exception as e:
        logger.error(f"PDF extraction failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract text from PDF: {str(e)}"
        )
