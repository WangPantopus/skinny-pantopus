-- 154_mail_day_triage.sql
-- P3F / A13.16 — Physical-mail "My Mail Day" triage backend (rebuild).
--
-- The triage backend was previously removed from the repo (the
-- MailDayViewModel notes "Backend has been removed"), leaving the screen on
-- sample data. The `/mailday/*` routes under mailbox v2 phase-3 are an
-- unrelated notification *digest*, not a triage model. The stop-gap that
-- pointed the screen at `/pending` + `/resolve` loses streak, recap,
-- reviewed-history and server counts (it derives them client-side).
--
-- This rebuilds the triage model the screen renders, defined directly from
-- the MailDayViewModel's fields:
--   * MailDayItem — one physical piece in the triage queue. `unreviewed`
--     carries the AI routing suggestion; a route / junk / return decision
--     moves it to `reviewed` with a recipient chip + tint.
--   * MailDaySession — one row per user per day, carrying the streak,
--     finish-day commit, and a recap snapshot (pieces + per-action counts).
--
-- Items reuse the digital-mail primitives where applicable (optional
-- `mail_id` linkage to `Mail`, home scoping via `HomeOccupancy`, and a
-- best-effort backfill from the unresolved `MailRoutingQueue`) but model
-- the physical piece the screen actually triages. Column names are the
-- snake_case of the MailDayContent / MailDayItem fields, kept in lockstep
-- with the iOS + Android render models.

CREATE TABLE IF NOT EXISTS "public"."MailDayItem" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "home_id" "uuid",
    "mail_id" "uuid",
    "kind" "text" DEFAULT 'envelope'::"text" NOT NULL,
    "label" "text" DEFAULT ''::"text" NOT NULL,
    "sender" "text",
    "suggested_name" "text",
    "suggested_avatar" "text" DEFAULT 'personal_sky'::"text" NOT NULL,
    "confidence_percent" integer DEFAULT 0 NOT NULL,
    "secondary_label" "text",
    "status" "text" DEFAULT 'unreviewed'::"text" NOT NULL,
    "action" "text",
    "routed_to" "text",
    "routed_tint" "text",
    "day_date" "date" DEFAULT (("now"() AT TIME ZONE 'utc'::"text"))::"date" NOT NULL,
    "scanned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "MailDayItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MailDayItem_kind_chk" CHECK (("kind" = ANY (ARRAY[
        'envelope'::"text", 'magazine'::"text", 'postcard'::"text",
        'bill'::"text", 'package'::"text", 'flyer'::"text"]))),
    CONSTRAINT "MailDayItem_avatar_chk" CHECK (("suggested_avatar" = ANY (ARRAY[
        'personal_sky'::"text", 'household_green'::"text"]))),
    CONSTRAINT "MailDayItem_status_chk" CHECK (("status" = ANY (ARRAY[
        'unreviewed'::"text", 'reviewed'::"text"]))),
    CONSTRAINT "MailDayItem_action_chk" CHECK (("action" IS NULL OR "action" = ANY (ARRAY[
        'routed'::"text", 'junked'::"text", 'returned'::"text"]))),
    CONSTRAINT "MailDayItem_tint_chk" CHECK (("routed_tint" IS NULL OR "routed_tint" = ANY (ARRAY[
        'person_primary'::"text", 'household_home'::"text"]))),
    CONSTRAINT "MailDayItem_confidence_chk" CHECK (("confidence_percent" >= 0 AND "confidence_percent" <= 100))
);

CREATE TABLE IF NOT EXISTS "public"."MailDaySession" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "day_date" "date" NOT NULL,
    "finished_at" timestamp with time zone,
    "streak_days" integer DEFAULT 0 NOT NULL,
    "pieces" integer DEFAULT 0 NOT NULL,
    "routed_count" integer DEFAULT 0 NOT NULL,
    "junked_count" integer DEFAULT 0 NOT NULL,
    "returned_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "MailDaySession_pkey" PRIMARY KEY ("id")
);

-- One session per user per day (drives upsert ON CONFLICT (user_id, day_date)).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MailDaySession_user_day_key'
  ) THEN
    ALTER TABLE "public"."MailDaySession"
      ADD CONSTRAINT "MailDaySession_user_day_key" UNIQUE ("user_id", "day_date");
  END IF;
END $$;

-- Foreign keys (guarded for idempotent re-runs).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MailDayItem_user_id_fkey') THEN
    ALTER TABLE "public"."MailDayItem"
      ADD CONSTRAINT "MailDayItem_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MailDayItem_home_id_fkey') THEN
    ALTER TABLE "public"."MailDayItem"
      ADD CONSTRAINT "MailDayItem_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MailDayItem_mail_id_fkey') THEN
    ALTER TABLE "public"."MailDayItem"
      ADD CONSTRAINT "MailDayItem_mail_id_fkey"
      FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MailDaySession_user_id_fkey') THEN
    ALTER TABLE "public"."MailDaySession"
      ADD CONSTRAINT "MailDaySession_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- The today-frame query: a user's pieces for a given day, split by status.
CREATE INDEX IF NOT EXISTS "idx_mailday_item_user_day_status"
  ON "public"."MailDayItem" ("user_id", "day_date", "status");

-- Idempotent backfill lookup: has this Mail already been pulled into a day?
CREATE INDEX IF NOT EXISTS "idx_mailday_item_user_mail"
  ON "public"."MailDayItem" ("user_id", "mail_id");
