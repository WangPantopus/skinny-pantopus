-- 164_calendarly_screen_support.sql
-- Calendarly — schema additions to support the design screen suite (non-payment MVP gaps):
--   BookingPage: pause toggle, configurable default reminders, display cancellation policy.
--   BookingToken: pre-offered slots for one-off links.
--   HomeCalendarEvent: RSVP request + multi-reminder, plus a per-person RSVP attendee table.
--   SchedulingNotificationPreference: a host's per-event notification channel matrix.
-- Depends on 159-163. Idempotent; mirrors supabase/migrations/20260613000005_*.

-- ============================================================
-- 1. BookingPage — pause, reminders, cancellation policy text
-- ============================================================
ALTER TABLE "public"."BookingPage" ADD COLUMN IF NOT EXISTS "is_paused" boolean DEFAULT false NOT NULL;
ALTER TABLE "public"."BookingPage" ADD COLUMN IF NOT EXISTS "reminder_minutes" integer[] DEFAULT ARRAY[1440, 60] NOT NULL;
ALTER TABLE "public"."BookingPage" ADD COLUMN IF NOT EXISTS "cancellation_policy" "text";

-- ============================================================
-- 2. BookingToken — pre-offered slots for one-off links
-- ============================================================
ALTER TABLE "public"."BookingToken" ADD COLUMN IF NOT EXISTS "offered_slots" "jsonb";

-- ============================================================
-- 3. HomeCalendarEvent — RSVP request + multi-reminder (additive to existing table)
-- ============================================================
ALTER TABLE "public"."HomeCalendarEvent" ADD COLUMN IF NOT EXISTS "request_rsvp" boolean DEFAULT false NOT NULL;
ALTER TABLE "public"."HomeCalendarEvent" ADD COLUMN IF NOT EXISTS "reminders" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL;

-- ============================================================
-- 4. HomeCalendarEventAttendee — per-person RSVP for home calendar events
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."HomeCalendarEventAttendee" (
    "id"          "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id"    "uuid" NOT NULL,
    "user_id"     "uuid" NOT NULL,
    "rsvp_status" "public"."booking_rsvp_status" DEFAULT 'pending' NOT NULL,
    "created_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeCalendarEventAttendee_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."HomeCalendarEventAttendee" OWNER TO "postgres";

-- ============================================================
-- 5. SchedulingNotificationPreference — host's per-event channel matrix (one row per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."SchedulingNotificationPreference" (
    "id"         "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id"    "uuid" NOT NULL,
    "prefs"      "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "SchedulingNotificationPreference_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."SchedulingNotificationPreference" OWNER TO "postgres";

-- ============================================================
-- 6. FOREIGN KEYS (idempotent)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HomeCalendarEventAttendee_event_id_fkey') THEN
    ALTER TABLE "public"."HomeCalendarEventAttendee"
      ADD CONSTRAINT "HomeCalendarEventAttendee_event_id_fkey"
      FOREIGN KEY ("event_id") REFERENCES "public"."HomeCalendarEvent"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HomeCalendarEventAttendee_user_id_fkey') THEN
    ALTER TABLE "public"."HomeCalendarEventAttendee"
      ADD CONSTRAINT "HomeCalendarEventAttendee_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingNotificationPreference_user_id_fkey') THEN
    ALTER TABLE "public"."SchedulingNotificationPreference"
      ADD CONSTRAINT "SchedulingNotificationPreference_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 7. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS "HomeCalendarEventAttendee_event_idx" ON "public"."HomeCalendarEventAttendee" ("event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "HomeCalendarEventAttendee_unique" ON "public"."HomeCalendarEventAttendee" ("event_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "SchedulingNotificationPreference_user_unique" ON "public"."SchedulingNotificationPreference" ("user_id");

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE "public"."HomeCalendarEventAttendee"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SchedulingNotificationPreference" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hcea_service" ON "public"."HomeCalendarEventAttendee";
CREATE POLICY "hcea_service" ON "public"."HomeCalendarEventAttendee" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "hcea_read" ON "public"."HomeCalendarEventAttendee";
CREATE POLICY "hcea_read" ON "public"."HomeCalendarEventAttendee" FOR SELECT USING (
  "user_id" = "auth"."uid"()
  OR EXISTS (
    SELECT 1 FROM "public"."HomeCalendarEvent" e
    WHERE e."id" = "HomeCalendarEventAttendee"."event_id"
      AND "public"."home_has_permission"(e."home_id", 'calendar.view'::"public"."home_permission", "auth"."uid"())
  )
);

DROP POLICY IF EXISTS "schednotifpref_service" ON "public"."SchedulingNotificationPreference";
CREATE POLICY "schednotifpref_service" ON "public"."SchedulingNotificationPreference" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "schednotifpref_owner" ON "public"."SchedulingNotificationPreference";
CREATE POLICY "schednotifpref_owner" ON "public"."SchedulingNotificationPreference" FOR SELECT USING ("user_id" = "auth"."uid"());

-- ============================================================
-- 9. GRANTS
-- ============================================================
GRANT ALL ON TABLE "public"."HomeCalendarEventAttendee"        TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."SchedulingNotificationPreference" TO "authenticated", "service_role";
