-- ============================================================
-- 198 — Address calendar rules: seeds must be idempotent
--
-- The registry's seed migrations (195, 197) end in ON CONFLICT DO NOTHING,
-- but the table had no uniqueness for state/county/city rows, so applying
-- the same seed twice (both migration folders, a re-run) doubled every
-- pickup day and council meeting on the Today card. Collapse existing
-- duplicates, then make the seed shape unique.
-- ============================================================

DELETE FROM "public"."AddressCalendarRule" a
USING "public"."AddressCalendarRule" b
WHERE a.scope_type = b.scope_type
  AND a.scope_key = b.scope_key
  AND a.kind = b.kind
  AND a.rrule = b.rrule
  AND a.dtstart = b.dtstart
  AND a.title = b.title
  AND a.scope_type <> 'home'
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS "AddressCalendarRule_seed_uniq"
    ON "public"."AddressCalendarRule" ("scope_type", "scope_key", "kind", "rrule", "dtstart", "title")
    WHERE "scope_type" <> 'home';
