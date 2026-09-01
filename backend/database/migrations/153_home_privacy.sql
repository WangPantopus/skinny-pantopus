-- 153_home_privacy.sql
-- P3F / A14.2 — Per-home privacy & security toggles backend.
--
-- The per-home "Security" screen (HomeSecurityView / HomeSecurityScreen)
-- renders 9 consumer privacy toggles across three groups (Access control,
-- Privacy, Documents). Until now those toggles flipped LOCAL state only —
-- there was no backend:
--   * `homeOwnership /:id/security` governs ownership/claim-policy enums
--     (owner_claim_policy, member_attach_policy, …) — a different concept.
--   * `HomePreference` carries neighborhood-visibility prefs
--     (visibility_level, open_to_lending, …) — also a different concept.
--
-- This adds a dedicated `HomePrivacy` record (exactly one row per home)
-- backing `GET/PATCH /api/homes/:id/privacy`. The column names are the
-- snake_case of the camelCase toggle ids the clients send, kept in
-- lockstep with HomeSecurityViewModel `Toggles` / `HomeSecurityToggles`.
--
-- Defaults mirror the design's "balanced setup" baseline (5 of 9 on) so a
-- freshly-created home reads the same calm state the screen ships with.

CREATE TABLE IF NOT EXISTS "public"."HomePrivacy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    -- Access control group
    "guest_approval" boolean DEFAULT true NOT NULL,
    "member_name_visibility" boolean DEFAULT true NOT NULL,
    "address_precision" boolean DEFAULT false NOT NULL,
    -- Privacy group
    "activity_visibility" boolean DEFAULT true NOT NULL,
    "map_opt_out" boolean DEFAULT false NOT NULL,
    "notification_previews" boolean DEFAULT true NOT NULL,
    -- Documents group
    "doc_lock" boolean DEFAULT true NOT NULL,
    "photo_blur" boolean DEFAULT false NOT NULL,
    "vault_auto_lock" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomePrivacy_pkey" PRIMARY KEY ("id")
);

-- One privacy record per home (drives upsert ON CONFLICT (home_id)).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomePrivacy_home_id_key'
  ) THEN
    ALTER TABLE "public"."HomePrivacy"
      ADD CONSTRAINT "HomePrivacy_home_id_key" UNIQUE ("home_id");
  END IF;
END $$;

-- FK to Home; the privacy record dies with the home.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomePrivacy_home_id_fkey'
  ) THEN
    ALTER TABLE "public"."HomePrivacy"
      ADD CONSTRAINT "HomePrivacy_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
END $$;
