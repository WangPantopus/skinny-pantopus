-- 165_calendarly_advanced.sql
-- Calendarly — schema for the remaining (non-gig-payment) feature gaps so the frontend can wire
-- every screen: message templates (workflows), waitlist, meeting polls, and reschedule-propose.
-- Workflows (SchedulingWorkflow), packages (BookingPackage/PackageCredit), invoices
-- (BusinessInvoice), and connected calendars (ConnectedCalendar) already have tables.
-- Depends on 159-164. Idempotent; mirror 20260613000006_*.

-- ============================================================
-- 1. MessageTemplate — reusable workflow message content (owner-polymorphic)
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."MessageTemplate" (
    "id"            "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type"    "public"."scheduling_owner_type" NOT NULL,
    "owner_id"      "uuid" NOT NULL,
    "owner_user_id" "uuid",
    "home_id"       "uuid",
    "name"          "text" NOT NULL,
    "channel"       "text" DEFAULT 'email' NOT NULL,
    "subject"       "text",
    "body"          "text" NOT NULL,
    "is_active"     boolean DEFAULT true NOT NULL,
    "created_by"    "uuid",
    "created_at"    timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"    timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MessageTemplate_channel_chk" CHECK (("channel" = ANY (ARRAY['email'::"text", 'push'::"text", 'in_app'::"text", 'sms'::"text"]))),
    CONSTRAINT "MessageTemplate_owner_chk" CHECK (
        ("owner_type" = 'home' AND "home_id" IS NOT NULL AND "owner_user_id" IS NULL AND "owner_id" = "home_id")
        OR ("owner_type" = ANY (ARRAY['user'::"public"."scheduling_owner_type", 'business'::"public"."scheduling_owner_type"])
            AND "owner_user_id" IS NOT NULL AND "home_id" IS NULL AND "owner_id" = "owner_user_id")
    )
);
ALTER TABLE "public"."MessageTemplate" OWNER TO "postgres";

-- ============================================================
-- 2. SchedulingWaitlist — invitee waitlist for fully-booked / unavailable slots
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."SchedulingWaitlist" (
    "id"              "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type_id"   "uuid" NOT NULL,
    "owner_type"      "public"."scheduling_owner_type" NOT NULL,
    "owner_id"        "uuid" NOT NULL,
    "invitee_user_id" "uuid",
    "invitee_name"    "text",
    "invitee_email"   "text",
    "desired_from"    timestamp with time zone,
    "desired_to"      timestamp with time zone,
    "status"          "text" DEFAULT 'waiting' NOT NULL,
    "notified_at"     timestamp with time zone,
    "created_at"      timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "SchedulingWaitlist_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SchedulingWaitlist_status_chk" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'promoted'::"text", 'cancelled'::"text"])))
);
ALTER TABLE "public"."SchedulingWaitlist" OWNER TO "postgres";

-- ============================================================
-- 3. Meeting polls (Doodle-style "find a time" by vote)
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."SchedulingPoll" (
    "id"                   "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type"           "public"."scheduling_owner_type" NOT NULL,
    "owner_id"             "uuid" NOT NULL,
    "owner_user_id"        "uuid",
    "home_id"              "uuid",
    "title"                "text" NOT NULL,
    "description"          "text",
    "duration_min"         integer DEFAULT 30 NOT NULL,
    "status"               "text" DEFAULT 'open' NOT NULL,
    "finalized_booking_id" "uuid",
    "finalized_start_at"   timestamp with time zone,
    "created_by"           "uuid" NOT NULL,
    "created_at"           timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"           timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "SchedulingPoll_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SchedulingPoll_status_chk" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"]))),
    CONSTRAINT "SchedulingPoll_owner_chk" CHECK (
        ("owner_type" = 'home' AND "home_id" IS NOT NULL AND "owner_user_id" IS NULL AND "owner_id" = "home_id")
        OR ("owner_type" = ANY (ARRAY['user'::"public"."scheduling_owner_type", 'business'::"public"."scheduling_owner_type"])
            AND "owner_user_id" IS NOT NULL AND "home_id" IS NULL AND "owner_id" = "owner_user_id")
    )
);
ALTER TABLE "public"."SchedulingPoll" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."SchedulingPollOption" (
    "id"         "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id"    "uuid" NOT NULL,
    "start_at"   timestamp with time zone NOT NULL,
    "end_at"     timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "SchedulingPollOption_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."SchedulingPollOption" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."SchedulingPollVote" (
    "id"         "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id"    "uuid" NOT NULL,
    "option_id"  "uuid" NOT NULL,
    "voter_user_id" "uuid",
    "voter_name" "text",
    "voter_key"  "text" NOT NULL, -- user id or normalized email; used for dedupe per option
    "value"      "text" DEFAULT 'yes' NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "SchedulingPollVote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SchedulingPollVote_value_chk" CHECK (("value" = ANY (ARRAY['yes'::"text", 'maybe'::"text", 'no'::"text"])))
);
ALTER TABLE "public"."SchedulingPollVote" OWNER TO "postgres";

-- ============================================================
-- 4. Booking — propose-vs-force reschedule (no enum change; columns gate the pending proposal)
-- ============================================================
ALTER TABLE "public"."Booking" ADD COLUMN IF NOT EXISTS "proposed_start_at" timestamp with time zone;
ALTER TABLE "public"."Booking" ADD COLUMN IF NOT EXISTS "proposed_host_id" "uuid";
ALTER TABLE "public"."Booking" ADD COLUMN IF NOT EXISTS "proposed_by" "uuid";

-- ============================================================
-- 5. FOREIGN KEYS (idempotent)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageTemplate_owner_user_id_fkey') THEN
    ALTER TABLE "public"."MessageTemplate" ADD CONSTRAINT "MessageTemplate_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageTemplate_home_id_fkey') THEN
    ALTER TABLE "public"."MessageTemplate" ADD CONSTRAINT "MessageTemplate_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingWaitlist_event_type_id_fkey') THEN
    ALTER TABLE "public"."SchedulingWaitlist" ADD CONSTRAINT "SchedulingWaitlist_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "public"."EventType"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingWaitlist_invitee_user_id_fkey') THEN
    ALTER TABLE "public"."SchedulingWaitlist" ADD CONSTRAINT "SchedulingWaitlist_invitee_user_id_fkey" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingPoll_owner_user_id_fkey') THEN
    ALTER TABLE "public"."SchedulingPoll" ADD CONSTRAINT "SchedulingPoll_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingPoll_home_id_fkey') THEN
    ALTER TABLE "public"."SchedulingPoll" ADD CONSTRAINT "SchedulingPoll_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingPollOption_poll_id_fkey') THEN
    ALTER TABLE "public"."SchedulingPollOption" ADD CONSTRAINT "SchedulingPollOption_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."SchedulingPoll"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingPollVote_poll_id_fkey') THEN
    ALTER TABLE "public"."SchedulingPollVote" ADD CONSTRAINT "SchedulingPollVote_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."SchedulingPoll"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingPollVote_option_id_fkey') THEN
    ALTER TABLE "public"."SchedulingPollVote" ADD CONSTRAINT "SchedulingPollVote_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."SchedulingPollOption"("id") ON DELETE CASCADE;
  END IF;
  -- created_by / finalized_booking_id integrity (match the pattern used by other tables).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageTemplate_created_by_fkey') THEN
    ALTER TABLE "public"."MessageTemplate" ADD CONSTRAINT "MessageTemplate_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingPoll_created_by_fkey') THEN
    ALTER TABLE "public"."SchedulingPoll" ADD CONSTRAINT "SchedulingPoll_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingPoll_finalized_booking_id_fkey') THEN
    ALTER TABLE "public"."SchedulingPoll" ADD CONSTRAINT "SchedulingPoll_finalized_booking_id_fkey" FOREIGN KEY ("finalized_booking_id") REFERENCES "public"."Booking"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 6. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS "MessageTemplate_owner_idx" ON "public"."MessageTemplate" ("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "SchedulingWaitlist_event_type_idx" ON "public"."SchedulingWaitlist" ("event_type_id", "status");
CREATE INDEX IF NOT EXISTS "SchedulingWaitlist_owner_idx" ON "public"."SchedulingWaitlist" ("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "SchedulingPoll_owner_idx" ON "public"."SchedulingPoll" ("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "SchedulingPollOption_poll_idx" ON "public"."SchedulingPollOption" ("poll_id");
CREATE INDEX IF NOT EXISTS "SchedulingPollVote_poll_idx" ON "public"."SchedulingPollVote" ("poll_id");
CREATE UNIQUE INDEX IF NOT EXISTS "SchedulingPollVote_unique" ON "public"."SchedulingPollVote" ("option_id", "voter_key");

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE "public"."MessageTemplate"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SchedulingWaitlist"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SchedulingPoll"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SchedulingPollOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SchedulingPollVote"  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgtpl_service" ON "public"."MessageTemplate";
CREATE POLICY "msgtpl_service" ON "public"."MessageTemplate" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "msgtpl_read" ON "public"."MessageTemplate";
CREATE POLICY "msgtpl_read" ON "public"."MessageTemplate" FOR SELECT USING (
  "owner_user_id" = "auth"."uid"()
  OR ("owner_type" = 'home' AND "public"."home_has_permission"("home_id", 'calendar.view'::"public"."home_permission", "auth"."uid"()))
);

DROP POLICY IF EXISTS "waitlist_service" ON "public"."SchedulingWaitlist";
CREATE POLICY "waitlist_service" ON "public"."SchedulingWaitlist" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "waitlist_read" ON "public"."SchedulingWaitlist";
CREATE POLICY "waitlist_read" ON "public"."SchedulingWaitlist" FOR SELECT USING ("invitee_user_id" = "auth"."uid"());

DROP POLICY IF EXISTS "poll_service" ON "public"."SchedulingPoll";
CREATE POLICY "poll_service" ON "public"."SchedulingPoll" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "polloption_service" ON "public"."SchedulingPollOption";
CREATE POLICY "polloption_service" ON "public"."SchedulingPollOption" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "pollvote_service" ON "public"."SchedulingPollVote";
CREATE POLICY "pollvote_service" ON "public"."SchedulingPollVote" FOR ALL USING ("auth"."role"() = 'service_role');

-- ============================================================
-- 8. GRANTS
-- ============================================================
GRANT ALL ON TABLE "public"."MessageTemplate"      TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."SchedulingWaitlist"   TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."SchedulingPoll"       TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."SchedulingPollOption" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."SchedulingPollVote"   TO "authenticated", "service_role";
