"""
SQL parsing service using sqlparse.
"""
import logging
import sqlparse
from sqlparse.sql import Token, TokenList
from models import TokenInfo

logger = logging.getLogger(__name__)


def serialize_token(token: Token | TokenList) -> TokenInfo:
    """
    Recursively serialize a sqlparse token into our TokenInfo model.
    
    Args:
        token: sqlparse Token or TokenList
        
    Returns:
        TokenInfo with type, value, and nested tokens
    """
    token_type = str(token.ttype) if hasattr(token, 'ttype') else type(token).__name__
    
    # If it's a TokenList, recursively serialize children
    if isinstance(token, TokenList):
        return TokenInfo(
            type=token_type,
            value=str(token),
            tokens=[serialize_token(t) for t in token.tokens]
        )
    else:
        return TokenInfo(
            type=token_type,
            value=str(token),
            tokens=None
        )


def parse_sql(sql_text: str) -> tuple[list[list[TokenInfo]], bool, str | None]:
    """
    Parse SQL text into token tree structure.
    
    Args:
        sql_text: SQL text to parse
        
    Returns:
        Tuple of (statements, success, error_message)
        - statements: List of token trees (one per SQL statement)
        - success: Whether parsing succeeded
        - error_message: Error message if failed, None otherwise
    """
    try:
        # Parse SQL into statements
        parsed = sqlparse.parse(sql_text)
        
        if not parsed:
            logger.warning("SQL parse returned empty result")
            return [], True, None
        
        # Serialize each statement
        result = []
        for statement in parsed:
            statement_tokens = [serialize_token(token) for token in statement.tokens]
            result.append(statement_tokens)
        
        logger.info(f"Successfully parsed {len(result)} SQL statement(s)")
        return result, True, None
        
    except Exception as e:
        logger.error(f"SQL parsing failed: {str(e)}")
        # Return empty result rather than raising - graceful degradation
        return [], False, str(e)
