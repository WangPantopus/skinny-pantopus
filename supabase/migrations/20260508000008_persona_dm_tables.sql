-- Phase 1 / P1.11: PersonaDmThread + PersonaDmMessage.
--
-- Audience Profile design v2 §5.3 (DM tables), §7.2 (capability semantics
-- — Member quota of 5 threads/period; Insider quota of 25 plus
-- creator_can_initiate_dm). Threads are the unit of quota consumption;
-- once open, the thread allows unlimited messages within it.
--
-- The quota_usage_id on PersonaDmThread is the PersonaQuotaUsage row
-- that funded the thread open. ON DELETE SET NULL keeps thread history
-- intact even if a quota row is later purged.
--
-- Idempotent: safe to re-run after a partial failure.

CREATE TABLE IF NOT EXISTS "public"."PersonaDmThread" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "membership_id" uuid NOT NULL,
  "initiated_by_user_id" uuid NOT NULL,
  "initiated_by_role" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "fan_unread_count" int NOT NULL DEFAULT 0,
  "creator_unread_count" int NOT NULL DEFAULT 0,
  "last_message_at" timestamptz,
  "last_message_preview" text,
  "quota_usage_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PersonaDmThread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonaDmThread_status_check"
    CHECK ("status" IN ('open','closed','blocked')),
  CONSTRAINT "PersonaDmThread_initiated_by_role_check"
    CHECK ("initiated_by_role" IN ('fan','creator')),
  CONSTRAINT "PersonaDmThread_persona_id_fkey"
    FOREIGN KEY ("persona_id") REFERENCES "public"."PublicPersona"("id") ON DELETE CASCADE,
  CONSTRAINT "PersonaDmThread_membership_id_fkey"
    FOREIGN KEY ("membership_id") REFERENCES "public"."PersonaMembership"("id") ON DELETE CASCADE,
  CONSTRAINT "PersonaDmThread_initiated_by_user_id_fkey"
    FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."User"("id"),
  CONSTRAINT "PersonaDmThread_quota_usage_id_fkey"
    FOREIGN KEY ("quota_usage_id")
    REFERENCES "public"."PersonaQuotaUsage"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_persona_dm_thread_persona_recent"
  ON "public"."PersonaDmThread" ("persona_id", "last_message_at" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS "idx_persona_dm_thread_membership_recent"
  ON "public"."PersonaDmThread" ("membership_id", "last_message_at" DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS "public"."PersonaDmMessage" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "sender_role" text NOT NULL,
  "sender_user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "media" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "read_at" timestamptz,
  CONSTRAINT "PersonaDmMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonaDmMessage_sender_role_check"
    CHECK ("sender_role" IN ('creator','fan')),
  CONSTRAINT "PersonaDmMessage_thread_id_fkey"
    FOREIGN KEY ("thread_id") REFERENCES "public"."PersonaDmThread"("id") ON DELETE CASCADE,
  CONSTRAINT "PersonaDmMessage_sender_user_id_fkey"
    FOREIGN KEY ("sender_user_id") REFERENCES "public"."User"("id")
);

CREATE INDEX IF NOT EXISTS "idx_persona_dm_message_thread_time"
  ON "public"."PersonaDmMessage" ("thread_id", "created_at");

-- Service-role-only table grants. Reads / writes flow through the
-- backend personaDmService (P1.12 owns the route layer).
ALTER TABLE "public"."PersonaDmThread" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."PersonaDmThread" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."PersonaDmThread" TO "service_role";

ALTER TABLE "public"."PersonaDmMessage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."PersonaDmMessage" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."PersonaDmMessage" TO "service_role";
