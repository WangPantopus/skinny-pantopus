-- ============================================================
-- 199 — Address calendar: atomic pickup-day swap
--
-- The resident override replaces a household's garbage / recycling /
-- yard-waste rules. The API cannot upsert against the partial unique index
-- (scope_type = 'home'), and a delete followed by an insert leaves a window
-- where a failed insert has already removed the reminders they had. One
-- function, one transaction: either the new rules land or nothing changes.
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."set_home_pickup_rules"(
    p_home_id text,
    p_rows jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inserted integer;
BEGIN
    DELETE FROM "public"."AddressCalendarRule"
     WHERE scope_type = 'home'
       AND scope_key = p_home_id
       AND kind IN ('garbage', 'recycling', 'yard_waste');

    INSERT INTO "public"."AddressCalendarRule"
        (scope_type, scope_key, kind, title, detail, rrule, dtstart, all_day,
         lead_days, source, source_url, confidence, created_by, updated_at)
    SELECT 'home',
           p_home_id,
           r.kind,
           r.title,
           r.detail,
           r.rrule,
           r.dtstart,
           COALESCE(r.all_day, true),
           COALESCE(r.lead_days, 1),
           r.source,
           r.source_url,
           COALESCE(r.confidence, 'official'),
           r.created_by,
           COALESCE(r.updated_at, now())
      FROM jsonb_to_recordset(p_rows) AS r(
           kind text, title text, detail text, rrule text, dtstart date,
           all_day boolean, lead_days integer, source text, source_url text,
           confidence text, created_by uuid, updated_at timestamptz);

    GET DIAGNOSTICS inserted = ROW_COUNT;
    RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION "public"."set_home_pickup_rules"(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."set_home_pickup_rules"(text, jsonb) TO service_role;
