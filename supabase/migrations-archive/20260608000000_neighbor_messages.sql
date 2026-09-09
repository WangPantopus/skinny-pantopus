-- 155_neighbor_messages.sql
-- W2.6 — Neighbor messaging (verified-only, template-only, T&S).
--
-- A calm, low-volume channel for a verified resident to send a pre-written
-- heads-up to another verified home on the same block. The trust-and-safety
-- constraints are structural, not cosmetic:
--   * template-only — `template_id` + the frozen `body` are stored; there is
--     never any free text, so nothing typed can be delivered.
--   * anonymous — the row keeps `sender_user_id` server-side ONLY. The
--     serializer never returns it, so the recipient sees "a verified neighbor
--     nearby", never a name or address. Block resolves the sender from the
--     row id without ever exposing who they are.
--   * scoped — `block_geohash` records the shared geohash-6 cell the send was
--     validated against (sender and recipient must be on the same block).
--   * blockable / reportable — block reuses UserBlock; report + not-helpful
--     are recorded inline and never notify the sender.
--
-- Delivery reuses the existing Notification pipeline (notificationService),
-- so there is no new transport — only this record of the message itself.

CREATE TABLE IF NOT EXISTS "public"."NeighborMessage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    -- Identity firewall: kept private, never serialized to the recipient.
    "sender_user_id" "uuid" NOT NULL,
    "sender_home_id" "uuid",
    "recipient_user_id" "uuid" NOT NULL,
    "recipient_home_id" "uuid",
    -- The shared block the send was validated against (geohash-6).
    "block_geohash" "text" NOT NULL,
    -- Template-only: id + frozen rendered body. No free text, ever.
    "template_id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "body" "text" NOT NULL,
    -- Templated reply (anonymous both ways), if the recipient sends one.
    "reply_template_id" "text",
    "reply_body" "text",
    "replied_at" timestamp with time zone,
    -- Recipient-side T&S signals — none of these notify the sender.
    "not_helpful" boolean DEFAULT false NOT NULL,
    "reported_at" timestamp with time zone,
    "report_reason" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "NeighborMessage_pkey" PRIMARY KEY ("id")
);

-- Recipient inbox read + sender rate-limit window are the hot paths.
CREATE INDEX IF NOT EXISTS "NeighborMessage_recipient_idx"
  ON "public"."NeighborMessage" ("recipient_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "NeighborMessage_sender_window_idx"
  ON "public"."NeighborMessage" ("sender_user_id", "created_at" DESC);

-- FKs: a message dies with either party's account; homes may be detached.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NeighborMessage_sender_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."NeighborMessage"
      ADD CONSTRAINT "NeighborMessage_sender_user_id_fkey"
      FOREIGN KEY ("sender_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NeighborMessage_recipient_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."NeighborMessage"
      ADD CONSTRAINT "NeighborMessage_recipient_user_id_fkey"
      FOREIGN KEY ("recipient_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NeighborMessage_sender_home_id_fkey'
  ) THEN
    ALTER TABLE "public"."NeighborMessage"
      ADD CONSTRAINT "NeighborMessage_sender_home_id_fkey"
      FOREIGN KEY ("sender_home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NeighborMessage_recipient_home_id_fkey'
  ) THEN
    ALTER TABLE "public"."NeighborMessage"
      ADD CONSTRAINT "NeighborMessage_recipient_home_id_fkey"
      FOREIGN KEY ("recipient_home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;
  END IF;
END $$;
