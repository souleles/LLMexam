"""
Tests for SQL parsing service.
"""
import pytest
from services.sql_service import parse_sql


def test_parse_simple_select():
    """Test parsing a simple SELECT statement."""
    sql = "SELECT * FROM users;"
    statements, success, error = parse_sql(sql)
    
    assert success is True
    assert error is None
    assert len(statements) > 0


def test_parse_complex_query():
    """Test parsing complex SQL with JOIN and subquery."""
    sql = """
    SELECT u.name, COUNT(o.id) as order_count
    FROM users u
    INNER JOIN orders o ON u.id = o.user_id
    WHERE u.id IN (SELECT user_id FROM premium_users)
    GROUP BY u.name
    HAVING COUNT(o.id) > 5;
    """
    statements, success, error = parse_sql(sql)
    
    assert success is True
    assert error is None
    assert len(statements) == 1


def test_parse_multiple_statements():
    """Test parsing multiple SQL statements."""
    sql = """
    SELECT * FROM users;
    INSERT INTO logs (message) VALUES ('test');
    UPDATE users SET active = true WHERE id = 1;
    """
    statements, success, error = parse_sql(sql)
    
    assert success is True
    assert error is None
    assert len(statements) == 3


def test_parse_invalid_sql():
    """Test parsing invalid SQL (should not raise, return empty)."""
    sql = "SELECT * FORM users;"  # Typo: FORM instead of FROM
    statements, success, error = parse_sql(sql)
    
    # Should handle gracefully
    assert isinstance(statements, list)


def test_parse_empty_string():
    """Test parsing empty SQL string."""
    sql = ""
    statements, success, error = parse_sql(sql)
    
    assert success is True
    assert error is None
    assert len(statements) == 0
