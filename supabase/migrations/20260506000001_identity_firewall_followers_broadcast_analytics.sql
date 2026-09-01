-- Identity Firewall: follower management and basic broadcast counters.
--
-- Additive/idempotent so environments that already ran the MVP migrations can
-- apply this safely.

ALTER TABLE "public"."BroadcastMessage"
  ADD COLUMN IF NOT EXISTS "delivered_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "read_count" integer DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_persona_follow_persona_status_created"
  ON "public"."PersonaFollow" ("persona_id", "status", "created_at" DESC);
