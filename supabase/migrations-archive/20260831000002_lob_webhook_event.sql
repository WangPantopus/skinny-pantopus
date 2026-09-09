-- Migration 186: Idempotency + replay protection for Lob webhooks
--
-- SECURITY. routes/lobWebhook.js verified the Lob signature only when
-- LOB_WEBHOOK_SECRET happened to be set, and that variable was not in the
-- production-required list, so a production deploy missing it accepted any
-- unauthenticated POST. There was also no replay protection and no event
-- de-duplication, so a captured (or forged) `postcard.returned_to_sender`
-- could be replayed to expire a legitimate user's in-flight verification.
--
-- This table gives the handler the same idempotency guarantee the Stripe
-- webhook already has (see "StripeWebhookEvent").

CREATE TABLE IF NOT EXISTS "LobWebhookEvent" (
  "id"           uuid DEFAULT gen_random_uuid() NOT NULL,
  "lob_event_id" text NOT NULL,
  "event_type"   text NOT NULL,
  "postcard_id"  text,
  "received_at"  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "LobWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- The de-duplication guarantee: a given Lob event is processed at most once.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_lob_webhook_event_id"
  ON "LobWebhookEvent" ("lob_event_id");

CREATE INDEX IF NOT EXISTS "idx_lob_webhook_event_received"
  ON "LobWebhookEvent" ("received_at");

ALTER TABLE "LobWebhookEvent" ENABLE ROW LEVEL SECURITY;

-- Service role only. This table is never read by an end user.
CREATE POLICY "lob_webhook_event_service"
  ON "LobWebhookEvent"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE "LobWebhookEvent" FROM "anon";
REVOKE ALL ON TABLE "LobWebhookEvent" FROM "authenticated";
GRANT ALL ON TABLE "LobWebhookEvent" TO "service_role";
