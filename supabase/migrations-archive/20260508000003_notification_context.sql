-- Phase 0 / P0.6: Notification firewall context column.
--
-- Audience Profile design v2 §6.2 / §13.7 + unified-IA §6: every notification
-- needs an explicit context tag (personal | audience | platform) so the in-app
-- feed never groups personal-side and audience-side activity together, even
-- when both rows share a user_id. This is independent of the existing
-- `context_type` column (personal | business), which scopes the personal /
-- business identity firewall — the two firewalls compose.
--
-- Phase 0 only adds the column and backfills. Templates / render harness /
-- audience notifications land in services/notificationTemplateRegistry.js
-- and Phase 1 respectively.
--
-- Idempotent: safe to re-run.

ALTER TABLE "public"."Notification"
  ADD COLUMN IF NOT EXISTS "context" text NOT NULL DEFAULT 'personal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Notification_context_check'
  ) THEN
    ALTER TABLE "public"."Notification"
      ADD CONSTRAINT "Notification_context_check"
      CHECK ("context" IN ('personal', 'audience', 'platform'));
  END IF;
END $$;

-- Backfill any rows that somehow ended up with NULL context (defensive).
UPDATE "public"."Notification"
SET "context" = 'personal'
WHERE "context" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_notification_user_context"
  ON "public"."Notification" ("user_id", "context", "created_at" DESC);
