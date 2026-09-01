from __future__ import annotations

import logging

from src.utils.supabase_errors import (
    clear_missing_table_warnings,
    is_missing_table_error,
    log_missing_table_once,
)


def test_identifies_missing_table_from_postgrest_payload():
    exc = Exception({
        "code": "PGRST205",
        "message": "Could not find the table 'public.AlertNotificationHistory' in the schema cache",
    })

    assert is_missing_table_error(exc, "AlertNotificationHistory") is True


def test_logs_missing_table_only_once(caplog):
    clear_missing_table_warnings()
    logger = logging.getLogger("tests.supabase_errors")
    exc = Exception({
        "code": "PGRST205",
        "message": "Could not find the table 'public.AlertNotificationHistory' in the schema cache",
    })

    with caplog.at_level("WARNING"):
        log_missing_table_once(logger, "AlertNotificationHistory", "alert dedup", exc)
        log_missing_table_once(logger, "AlertNotificationHistory", "alert dedup", exc)

    matches = [record for record in caplog.records if "Supabase table unavailable" in record.message]
    assert len(matches) == 1
