-- 173_mail_day_item_index_inferable.sql
-- Fixes a defect introduced by migration 170.
--
-- 170 added the MailDayItem dedup invariant as a PARTIAL unique index
-- (... WHERE mail_id IS NOT NULL). That is a correct constraint, but it
-- is not an INFERABLE one: Postgres can only match a partial index to an
-- `ON CONFLICT (cols)` clause when the statement repeats the index
-- predicate (`ON CONFLICT (cols) WHERE mail_id IS NOT NULL`), and
-- PostgREST's on_conflict parameter cannot emit a predicate. So
-- ensureTodayItems' upsert raised 42P10 ("no unique or exclusion
-- constraint matching the ON CONFLICT specification") on EVERY call —
-- and because the result was unchecked, the failure was swallowed and
-- the function reported success for zero rows written. Mail Day
-- materialization was dead: an empty triage screen and no daily push,
-- which is the exact failure 170 was written to prevent.
--
-- The predicate was never needed. In a Postgres unique index NULLs are
-- distinct, so rows with mail_id IS NULL (the dev seed route writes
-- them) are already unconstrained by a plain index over the same
-- columns. Dropping the predicate keeps the invariant identical and
-- makes the index inferable.
--
-- 170 is left untouched: it is already applied on some databases, and
-- editing an applied migration is how chains diverge.

DROP INDEX IF EXISTS "public"."MailDayItem_user_day_mail_key";

CREATE UNIQUE INDEX IF NOT EXISTS "MailDayItem_user_day_mail_key"
  ON "public"."MailDayItem" (user_id, day_date, mail_id);
