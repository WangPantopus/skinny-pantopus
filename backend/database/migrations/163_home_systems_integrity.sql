-- 163_home_systems_integrity.sql
-- Referential integrity for the Systems Ledger, and a real uniqueness
-- guarantee for provenance capture.
--
-- Two gaps in migration 161 and in the gig-completion hook:
--
-- 1. HomeSystem.home_id was NOT NULL with no REFERENCES, unlike every
--    sibling table (HomeMaintenanceLog cascades on Home delete; migration
--    154 adds four FKs in guarded blocks). Homes really are deleted
--    (routes/home.js), so rows carrying resident-entered years and a user
--    id would have survived the home they describe — an erasure gap, not
--    just untidiness. `updated_by` likewise had no FK.
--
-- 2. `recordCompletedJob` claims "one row per gig" but implements it as a
--    SELECT-then-INSERT with nothing behind it. Two concurrent owner
--    confirms double-insert; the easy path needs no Stripe race at all,
--    because a gig with a null payment_id skips capture entirely and
--    confirmCompletionHelper has no owner_confirmed_at guard. A partial
--    unique index makes the claim true rather than aspirational.

-- ── 1. HomeSystem foreign keys ──────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomeSystem_home_id_fkey'
  ) THEN
    ALTER TABLE "public"."HomeSystem"
      ADD CONSTRAINT "HomeSystem_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- The editor is a soft reference: losing the user must not lose the record
-- of the system, so this nulls rather than cascades.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomeSystem_updated_by_fkey'
  ) THEN
    ALTER TABLE "public"."HomeSystem"
      ADD CONSTRAINT "HomeSystem_updated_by_fkey"
      FOREIGN KEY ("updated_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ── 2. Provenance: one maintenance row per gig ──────────────
-- The evidence pointer moves out of the user-visible `notes` text and into
-- its own column, so the uniqueness guarantee does not depend on nobody
-- ever editing a note.
ALTER TABLE "public"."HomeMaintenanceLog"
  ADD COLUMN IF NOT EXISTS "gig_id" "uuid";

COMMENT ON COLUMN "public"."HomeMaintenanceLog"."gig_id" IS
  'The completed, paid Pantopus gig this entry came from. Set only by the provenance capture on owner-confirm; null for manually logged work. Backed by a partial unique index so a re-confirm cannot duplicate the history.';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomeMaintenanceLog_gig_id_fkey'
  ) THEN
    ALTER TABLE "public"."HomeMaintenanceLog"
      ADD CONSTRAINT "HomeMaintenanceLog_gig_id_fkey"
      FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill from the interim `notes: 'gig:<uuid>'` marker so existing rows
-- keep their evidence pointer and are covered by the index below.
--
-- Hardened against three real-data hazards that would hard-fail the
-- whole migration: (1) the marker regex is a STRICT uuid shape — the
-- old 36-chars-of-[hex-] class admitted strings the ::uuid cast throws
-- on; (2) markers pointing at since-deleted gigs are skipped rather
-- than violating the FK added above; (3) duplicate markers backfill
-- only the earliest row, so the unique index below can build.
WITH candidates AS (
  SELECT "id",
         (regexp_replace("notes", '^gig:', ''))::uuid AS gid,
         ROW_NUMBER() OVER (
           PARTITION BY regexp_replace("notes", '^gig:', '')
           ORDER BY "created_at", "id"
         ) AS rn
  FROM "public"."HomeMaintenanceLog"
  WHERE "gig_id" IS NULL
    AND "notes" ~ '^gig:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
)
UPDATE "public"."HomeMaintenanceLog" h
   SET "gig_id" = c.gid
  FROM candidates c
 WHERE h."id" = c."id"
   AND c.rn = 1
   AND EXISTS (SELECT 1 FROM "public"."Gig" g WHERE g."id" = c.gid);

-- Partial so manually logged work (gig_id NULL) is unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS "HomeMaintenanceLog_gig_id_key"
  ON "public"."HomeMaintenanceLog" ("gig_id")
  WHERE "gig_id" IS NOT NULL;

-- ── 3. Drop the dead index from migration 160 ───────────────
-- `MailDaySession_pending_notification_idx (day_date) WHERE notified_at IS
-- NULL` matches no query: every reader is a (user_id, day_date) point
-- lookup already served by MailDaySession_user_day_key. It only costs an
-- index-entry deletion each time the job claims a day.
DROP INDEX IF EXISTS "public"."MailDaySession_pending_notification_idx";
