-- Phase 0 / P0.1: Collapse PersonaFollow into PersonaMembership.
--
-- Background: Audience Profile + Paid Tier Ladder Design v2 (§5.2, §6.4) makes
-- PersonaMembership the single source of truth for persona ↔ user relationships.
-- This migration replaces the PersonaFollow table with a backwards-compatible
-- VIEW over PersonaMembership so existing read paths keep working while writes
-- migrate to the canonical PersonaMembership table.
--
-- The PersonaMembership table created here is intentionally minimal: enough
-- columns to host the existing free-Follower data plus the audience-side
-- identity columns (fan_handle, etc.) required by the bidirectional firewall.
-- Phase 1 (PR 1) extends it with tier_id NOT NULL, Stripe bookkeeping, and
-- period columns; the legacy compat columns (relationship_type, source,
-- notification_level, public_visibility, approved_*) are retained here so the
-- view exposes the exact shape existing app code reads, and Phase 1 removes
-- them once tiers replace those concepts.
--
-- Idempotent: safe to re-run after a partial failure.

-- ---------------------------------------------------------------------------
-- 0. Backup (only when PersonaFollow is still a base table)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'PersonaFollow'
      AND table_type = 'BASE TABLE'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS "public"."PersonaFollow_pre_migration_backup" AS
             SELECT * FROM "public"."PersonaFollow"';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. PersonaMembership table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."PersonaMembership" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  -- tier_id is intentionally nullable in Phase 0; PR 1 backfills + enforces NOT NULL.
  "tier_id" uuid,

  -- Audience-side identity. Generated at first follow. NEVER pre-filled from
  -- User.username unless the fan explicitly opts in (PR 3 handshake screen).
  "fan_handle" text NOT NULL,
  "fan_handle_normalized" text NOT NULL,
  "fan_display_name" text,
  "fan_avatar_url" text,

  -- Status check accepts BOTH the legacy PersonaFollow domain and the v2
  -- PersonaMembership domain so Phase 0 callers can keep writing the legacy
  -- values until PR 1 lands the tier-aware lifecycle.
  "status" text NOT NULL DEFAULT 'active',

  -- Legacy compatibility columns (mirrored from PersonaFollow). Phase 1 will
  -- collapse these into the tier-based model once PersonaTier exists.
  "relationship_type" text NOT NULL DEFAULT 'follower',
  "source" text NOT NULL DEFAULT 'self_follow',
  "notification_level" text NOT NULL DEFAULT 'all',
  "public_visibility" text NOT NULL DEFAULT 'private',
  "approved_by_user_id" uuid,
  "approved_at" timestamp with time zone,

  -- Audit trail of the personal-side username at migration time. Used only to
  -- verify the random-handle privacy invariant and dropped after verification.
  "migration_original_username" text,

  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "PersonaMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonaMembership_persona_user_key" UNIQUE ("persona_id", "user_id"),
  CONSTRAINT "PersonaMembership_persona_handle_key" UNIQUE ("persona_id", "fan_handle_normalized"),
  CONSTRAINT "PersonaMembership_persona_id_fkey"
    FOREIGN KEY ("persona_id") REFERENCES "public"."PublicPersona"("id") ON DELETE CASCADE,
  CONSTRAINT "PersonaMembership_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE,
  CONSTRAINT "PersonaMembership_approved_by_user_id_fkey"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL,
  CONSTRAINT "PersonaMembership_status_check" CHECK ("status" IN (
    -- Legacy PersonaFollow domain (Phase 0 callers):
    'pending', 'active', 'muted', 'blocked', 'removed',
    -- v2 PersonaMembership domain (Phase 1+ callers):
    'past_due', 'paused', 'canceled_pending', 'canceled', 'expired'
  )),
  CONSTRAINT "PersonaMembership_relationship_type_check" CHECK ("relationship_type" IN (
    'follower', 'patient', 'student', 'client', 'customer', 'subscriber', 'member'
  )),
  CONSTRAINT "PersonaMembership_source_check" CHECK ("source" IN (
    'self_follow', 'follow_request', 'request_approved', 'invite', 'import',
    'organization_managed',
    'personal_block_propagation', 'platform_safety', 'chargeback'
  )),
  CONSTRAINT "PersonaMembership_notification_level_check" CHECK ("notification_level" IN (
    'all', 'highlights', 'none'
  )),
  CONSTRAINT "PersonaMembership_public_visibility_check" CHECK ("public_visibility" IN (
    'private', 'visible_to_owner', 'public'
  )),
  CONSTRAINT "PersonaMembership_fan_handle_format" CHECK (
    char_length("fan_handle") BETWEEN 3 AND 64
    AND "fan_handle_normalized" = lower("fan_handle")
  )
);

CREATE INDEX IF NOT EXISTS "idx_persona_membership_persona_active"
  ON "public"."PersonaMembership" ("persona_id", "status")
  WHERE "status" = 'active';
CREATE INDEX IF NOT EXISTS "idx_persona_membership_user"
  ON "public"."PersonaMembership" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_persona_membership_persona_created"
  ON "public"."PersonaMembership" ("persona_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_persona_membership_user_created"
  ON "public"."PersonaMembership" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_persona_membership_persona_status_created"
  ON "public"."PersonaMembership" ("persona_id", "status", "created_at" DESC);

-- ---------------------------------------------------------------------------
-- 2. Migrate existing PersonaFollow rows.
--    fan_handle is derived from the row's UUID (8 hex chars → ~4B namespace per
--    persona; collision per-persona is negligible at v1 scale and the unique
--    index would catch any collision before it lands).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'PersonaFollow'
      AND table_type = 'BASE TABLE'
  ) THEN
    INSERT INTO "public"."PersonaMembership" (
      "id",
      "persona_id",
      "user_id",
      "tier_id",
      "fan_handle",
      "fan_handle_normalized",
      "fan_display_name",
      "fan_avatar_url",
      "status",
      "relationship_type",
      "source",
      "notification_level",
      "public_visibility",
      "approved_by_user_id",
      "approved_at",
      "migration_original_username",
      "joined_at",
      "created_at",
      "updated_at"
    )
    SELECT
      pf."id",
      pf."persona_id",
      pf."follower_user_id",
      NULL,
      'fan_' || lower(substring(replace(pf."id"::text, '-', '') from 1 for 8)),
      'fan_' || lower(substring(replace(pf."id"::text, '-', '') from 1 for 8)),
      NULL,
      NULL,
      pf."status",
      COALESCE(pf."relationship_type", 'follower'),
      COALESCE(pf."source", 'self_follow'),
      COALESCE(pf."notification_level", 'all'),
      COALESCE(pf."public_visibility", 'private'),
      pf."approved_by_user_id",
      pf."approved_at",
      u."username",
      pf."created_at",
      pf."created_at",
      pf."updated_at"
    FROM "public"."PersonaFollow" pf
    LEFT JOIN "public"."User" u ON u."id" = pf."follower_user_id"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Drop legacy table; recreate as a view of PersonaMembership.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "public"."PersonaFollow" CASCADE;

CREATE OR REPLACE VIEW "public"."PersonaFollow" AS
SELECT
  "id",
  "persona_id",
  "user_id" AS "follower_user_id",
  "relationship_type",
  "status",
  "source",
  "notification_level",
  "public_visibility",
  "approved_by_user_id",
  "approved_at",
  "created_at",
  "updated_at"
FROM "public"."PersonaMembership"
WHERE "tier_id" IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Row-level security on the new table; service role bypasses as before.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."PersonaMembership" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PersonaMembership_participant_read" ON "public"."PersonaMembership";
CREATE POLICY "PersonaMembership_participant_read"
  ON "public"."PersonaMembership"
  FOR SELECT
  USING (
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id"
    OR EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = "persona_id"
        AND pp."user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS "PersonaMembership_participant_write" ON "public"."PersonaMembership";
CREATE POLICY "PersonaMembership_participant_write"
  ON "public"."PersonaMembership"
  FOR ALL
  USING (
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id"
    OR EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = "persona_id"
        AND pp."user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  )
  WITH CHECK (
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id"
    OR EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = "persona_id"
        AND pp."user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

REVOKE ALL ON TABLE "public"."PersonaMembership" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."PersonaMembership" TO "service_role";

GRANT SELECT ON "public"."PersonaFollow" TO "anon", "authenticated", "service_role";
