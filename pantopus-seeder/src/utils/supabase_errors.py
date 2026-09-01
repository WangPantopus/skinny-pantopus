"""Helpers for interpreting Supabase/PostgREST error payloads."""

from __future__ import annotations

from typing import Any

_missing_table_warnings: set[tuple[str, str]] = set()


def _extract_error_payload(exc: Exception) -> dict[str, Any]:
    args = getattr(exc, "args", ())
    if args and isinstance(args[0], dict):
        return args[0]
    return {}


def get_supabase_error_code(exc: Exception) -> str:
    payload = _extract_error_payload(exc)
    code = payload.get("code") or getattr(exc, "code", "")
    return str(code or "")


def get_supabase_error_message(exc: Exception) -> str:
    payload = _extract_error_payload(exc)
    message = payload.get("message") or getattr(exc, "message", "") or str(exc)
    return str(message or "")


def is_missing_table_error(exc: Exception, table_name: str) -> bool:
    """Return True when a Supabase/PostgREST error indicates a missing table."""
    message = get_supabase_error_message(exc).lower()
    table_lower = str(table_name).lower()
    table_basename = table_lower.split(".")[-1]

    return (
        get_supabase_error_code(exc) == "PGRST205"
        or f'relation "{table_lower}" does not exist' in message
        or f'relation "{table_basename}" does not exist' in message
        or "could not find the table" in message
    )


def log_missing_table_once(logger: Any, table_name: str, feature: str, exc: Exception) -> None:
    """Log a missing-table warning only once per process/feature."""
    key = (str(table_name), str(feature))
    if key in _missing_table_warnings:
        return

    _missing_table_warnings.add(key)
    logger.warning(
        "Supabase table unavailable; %s is degraded until the migration is applied or the schema cache refreshes: table=%s code=%s message=%s",
        feature,
        table_name,
        get_supabase_error_code(exc) or "unknown",
        get_supabase_error_message(exc),
    )


def clear_missing_table_warnings() -> None:
    """Reset logged warning state for tests."""
    _missing_table_warnings.clear()
