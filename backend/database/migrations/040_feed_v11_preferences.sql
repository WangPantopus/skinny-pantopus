-- ============================================================
-- MIGRATION 040: Feed v1.1 — Topic Muting & Feed Preferences
--
-- Adds:
--   - surface column on PostMute for surface-scoped mutes
--   - UserFeedPreference table for per-surface toggles
--   - Block filtering support via Relationship.status
-- ============================================================

-- ─── 1. SURFACE-SCOPED TOPIC MUTING ──────────────────────

ALTER TABLE "public"."PostMute"
  ADD COLUMN IF NOT EXISTS "surface" text;

-- Index for surface-scoped mute lookups
CREATE INDEX IF NOT EXISTS "PostMute_user_surface_idx"
  ON "public"."PostMute" ("user_id", "surface");

-- ─── 2. USER FEED PREFERENCES ─────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."UserFeedPreference" (
  "user_id" uuid PRIMARY KEY REFERENCES "public"."User"(id) ON DELETE CASCADE,
  "hide_deals_place" boolean NOT NULL DEFAULT false,
  "hide_alerts_place" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. GRANTS ─────────────────────────────────────────────

GRANT ALL ON TABLE "public"."PostMute" TO "authenticated";
GRANT ALL ON TABLE "public"."PostMute" TO "service_role";
GRANT ALL ON TABLE "public"."UserFeedPreference" TO "authenticated";
GRANT ALL ON TABLE "public"."UserFeedPreference" TO "service_role";
