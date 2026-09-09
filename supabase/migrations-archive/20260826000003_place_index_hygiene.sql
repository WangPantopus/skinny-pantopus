-- ============================================================
-- Migration 171: Place index hygiene (audit remediation)
--
-- Three families of misses from the Waves 1-3 audit:
--
-- 1) The NFIP warm job's queue scans had NO usable index: its pending
--    scan (section_id + payload->>'pending', ordered by fetched_at) and
--    expired scan (section_id + expires_at) both walked the whole
--    multi-tenant PlaceSectionCache — a table that accumulates a row
--    per section per home/geohash/zip — every 15 minutes on every
--    instance. The partial index matches the pending query exactly and
--    stays proportional to the pending set.
--
-- 2) User-side FK columns on the Wave tables were unindexed, so every
--    User delete (CASCADE / SET NULL) seq-scans them.
--
-- 3) HomeRecordWatch_eval_idx (last_alert_at) matches no query the
--    weekly evaluator actually runs — pure write overhead. Dropped.
-- ============================================================

-- 1) NFIP warm queue scans.
CREATE INDEX IF NOT EXISTS "PlaceSectionCache_nfip_pending_idx"
  ON "public"."PlaceSectionCache" ("section_id", "fetched_at")
  WHERE (payload->>'pending') = 'true';

CREATE INDEX IF NOT EXISTS "PlaceSectionCache_section_expiry_idx"
  ON "public"."PlaceSectionCache" ("section_id", "expires_at");

-- 2) User-side FK indexes (guarded — some tables may not exist on
--    databases that have not taken the wave migrations yet).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ResidencyClaim') THEN
    CREATE INDEX IF NOT EXISTS "ResidencyClaim_user_idx"
      ON "public"."ResidencyClaim" ("user_id");
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'FridgeCard') THEN
    CREATE INDEX IF NOT EXISTS "FridgeCard_created_by_idx"
      ON "public"."FridgeCard" ("created_by");
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'HomeRecordWatch') THEN
    CREATE INDEX IF NOT EXISTS "HomeRecordWatch_user_idx"
      ON "public"."HomeRecordWatch" ("user_id");
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'BlockFounder') THEN
    CREATE INDEX IF NOT EXISTS "BlockFounder_user_idx"
      ON "public"."BlockFounder" ("user_id");
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'BlockInvite') THEN
    CREATE INDEX IF NOT EXISTS "BlockInvite_sender_home_idx"
      ON "public"."BlockInvite" ("sender_home_id");
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'MailDayItem') THEN
    -- (user_id, mail_id) exists; Mail-side deletes need mail_id leading.
    CREATE INDEX IF NOT EXISTS "MailDayItem_mail_idx"
      ON "public"."MailDayItem" ("mail_id");
  END IF;
END $$;

-- 3) The dead index.
DROP INDEX IF EXISTS "public"."HomeRecordWatch_eval_idx";
