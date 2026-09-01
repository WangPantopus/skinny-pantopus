-- Wedge Phase 1: FunnelEvent — minimal instrumentation for the T0 → T4 ladder.
--
-- Only the pre-account funnel steps need an event table. T3 (claim) and
-- T4 (verified) are durable state transitions already recorded by Home /
-- AddressVerificationAttempt and are derived by query. The event types
-- here cover the anonymous stretch of the funnel plus the T1 conversion:
--   t0_preview_viewed   client-side, T0 preview rendered (the preview
--                       route itself persists nothing, by contract)
--   t0_wall_viewed      client-side, soft wall shown/tapped
--   register_started    client-side, register form mounted
--   t1_account_created  server-side, successful registration
--
-- anon_id is a client-generated random id (localStorage) echoed on the
-- register call, so t0_* → t1 can be joined without cookies or PII.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "public"."FunnelEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_type" text NOT NULL,
  "user_id" uuid REFERENCES "public"."User"("id") ON DELETE SET NULL,
  "anon_id" text,
  "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "funnelevent_type_check" CHECK (
    "event_type" IN (
      't0_preview_viewed',
      't0_wall_viewed',
      'register_started',
      't1_account_created'
    )
  ),
  CONSTRAINT "funnelevent_anon_id_len" CHECK ("anon_id" IS NULL OR char_length("anon_id") <= 64)
);

CREATE INDEX IF NOT EXISTS "idx_funnelevent_type_created"
  ON "public"."FunnelEvent" ("event_type", "created_at");

CREATE INDEX IF NOT EXISTS "idx_funnelevent_anon"
  ON "public"."FunnelEvent" ("anon_id")
  WHERE "anon_id" IS NOT NULL;

-- Service-role writes only; clients go through the rate-limited public
-- endpoint, which whitelists the client-postable event types.
ALTER TABLE "public"."FunnelEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."FunnelEvent" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."FunnelEvent" TO "service_role";
