-- 159_calendarly_core.sql
-- Calendarly (#scheduling) — Phase 0 core: owner-polymorphic event types + personal availability.
-- One scheduling engine keyed by (owner_type, owner_id) where owner_type in (user, home, business).
-- Personal availability (schedule + rules + overrides + blocks) is the single source of truth;
-- home/business compose it (see availabilityService). This migration ships the public-page,
-- event-type, and availability tables. Bookings land in 160; packages/automations in 161.
--
-- Conventions: idempotent (CREATE ... IF NOT EXISTS, DO $$ guards), no BEGIN/COMMIT wrapper
-- (matches recent migrations 148–158), RLS enabled as defense-in-depth (all backend access is
-- via the service_role client which bypasses RLS).
--
-- Owner integrity: owner_id is polymorphic and cannot carry a single FK. Each owner-scoped table
-- additionally carries owner_user_id (FK User, for owner_type in user/business) and home_id
-- (FK Home, for owner_type=home), both ON DELETE CASCADE, with a CHECK keeping them consistent
-- with (owner_type, owner_id). This gives real referential integrity + cascade cleanup.

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scheduling_owner_type') THEN
    CREATE TYPE "public"."scheduling_owner_type" AS ENUM ('user', 'home', 'business');
    ALTER TYPE "public"."scheduling_owner_type" OWNER TO "postgres";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scheduling_assignment_mode') THEN
    CREATE TYPE "public"."scheduling_assignment_mode" AS ENUM ('one_on_one', 'collective', 'round_robin', 'group');
    ALTER TYPE "public"."scheduling_assignment_mode" OWNER TO "postgres";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scheduling_location_mode') THEN
    CREATE TYPE "public"."scheduling_location_mode" AS ENUM ('video', 'phone', 'in_person', 'custom', 'ask');
    ALTER TYPE "public"."scheduling_location_mode" OWNER TO "postgres";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE "public"."booking_status" AS ENUM ('pending', 'confirmed', 'cancelled', 'declined', 'completed', 'no_show');
    ALTER TYPE "public"."booking_status" OWNER TO "postgres";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_rsvp_status') THEN
    CREATE TYPE "public"."booking_rsvp_status" AS ENUM ('pending', 'going', 'maybe', 'declined');
    ALTER TYPE "public"."booking_rsvp_status" OWNER TO "postgres";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_token_kind') THEN
    CREATE TYPE "public"."booking_token_kind" AS ENUM ('manage', 'one_off');
    ALTER TYPE "public"."booking_token_kind" OWNER TO "postgres";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scheduling_refund_policy') THEN
    CREATE TYPE "public"."scheduling_refund_policy" AS ENUM ('full', 'partial', 'none', 'deposit_only');
    ALTER TYPE "public"."scheduling_refund_policy" OWNER TO "postgres";
  END IF;
END $$;

-- ============================================================
-- 2. AvailabilitySchedule (+ rules / overrides / blocks) — personal source of truth
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."AvailabilitySchedule" (
    "id"          "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id"     "uuid" NOT NULL,
    "name"        "text" DEFAULT 'Working hours' NOT NULL,
    "timezone"    "text" DEFAULT 'America/New_York' NOT NULL,
    "is_default"  boolean DEFAULT true NOT NULL,
    "created_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "AvailabilitySchedule_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."AvailabilitySchedule" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."AvailabilityRule" (
    "id"          "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "weekday"     smallint NOT NULL,
    "start_time"  time without time zone NOT NULL,
    "end_time"    time without time zone NOT NULL,
    "created_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AvailabilityRule_weekday_chk" CHECK (("weekday" >= 0 AND "weekday" <= 6)),
    CONSTRAINT "AvailabilityRule_time_chk" CHECK (("end_time" > "start_time"))
);
ALTER TABLE "public"."AvailabilityRule" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."AvailabilityOverride" (
    "id"             "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id"    "uuid" NOT NULL,
    "date"           "date" NOT NULL,
    "is_unavailable" boolean DEFAULT false NOT NULL,
    "start_time"     time without time zone,
    "end_time"       time without time zone,
    "created_at"     timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "AvailabilityOverride_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AvailabilityOverride_time_chk"
        CHECK (("is_unavailable" = true) OR ("start_time" IS NOT NULL AND "end_time" IS NOT NULL AND "end_time" > "start_time"))
);
ALTER TABLE "public"."AvailabilityOverride" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."AvailabilityBlock" (
    "id"              "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id"         "uuid" NOT NULL,
    "title"           "text",
    "start_at"        timestamp with time zone NOT NULL,
    "end_at"          timestamp with time zone NOT NULL,
    "recurrence_rule" "text",
    "created_at"      timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "AvailabilityBlock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AvailabilityBlock_time_chk" CHECK (("end_at" > "start_at"))
);
ALTER TABLE "public"."AvailabilityBlock" OWNER TO "postgres";

-- ============================================================
-- 3. BookingPage — public face of an owner (/book/:slug)
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."BookingPage" (
    "id"                   "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type"           "public"."scheduling_owner_type" NOT NULL,
    "owner_id"             "uuid" NOT NULL,
    "owner_user_id"        "uuid",
    "home_id"              "uuid",
    "slug"                 "text" NOT NULL,
    "title"                "text",
    "tagline"              "text",
    "avatar_url"           "text",
    "intro"                "text",
    "confirmation_message" "text",
    "timezone"             "text" DEFAULT 'America/New_York' NOT NULL,
    "is_live"              boolean DEFAULT false NOT NULL,
    "visibility"           "text" DEFAULT 'listed' NOT NULL,
    "branding"             "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by"           "uuid" NOT NULL,
    "created_at"           timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"           timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BookingPage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BookingPage_visibility_chk" CHECK (("visibility" = ANY (ARRAY['listed'::"text", 'unlisted'::"text"]))),
    CONSTRAINT "BookingPage_owner_chk" CHECK (
        ("owner_type" = 'home' AND "home_id" IS NOT NULL AND "owner_user_id" IS NULL AND "owner_id" = "home_id")
        OR ("owner_type" = ANY (ARRAY['user'::"public"."scheduling_owner_type", 'business'::"public"."scheduling_owner_type"])
            AND "owner_user_id" IS NOT NULL AND "home_id" IS NULL AND "owner_id" = "owner_user_id")
    )
);
ALTER TABLE "public"."BookingPage" OWNER TO "postgres";

-- ============================================================
-- 4. EventType — a bookable template (Calendly "event type" / business "service")
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."EventType" (
    "id"                       "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type"               "public"."scheduling_owner_type" NOT NULL,
    "owner_id"                 "uuid" NOT NULL,
    "owner_user_id"            "uuid",
    "home_id"                  "uuid",
    "page_id"                  "uuid" NOT NULL,
    "name"                     "text" NOT NULL,
    "slug"                     "text" NOT NULL,
    "description"              "text",
    "color"                    "text",
    "durations"                integer[] DEFAULT ARRAY[30] NOT NULL,
    "default_duration"         integer DEFAULT 30 NOT NULL,
    "location_mode"            "public"."scheduling_location_mode" DEFAULT 'video' NOT NULL,
    "location_detail"          "text",
    "assignment_mode"          "public"."scheduling_assignment_mode" DEFAULT 'one_on_one' NOT NULL,
    "requires_approval"        boolean DEFAULT false NOT NULL,
    "visibility"               "text" DEFAULT 'public' NOT NULL,
    "buffer_before_min"        integer DEFAULT 0 NOT NULL,
    "buffer_after_min"         integer DEFAULT 0 NOT NULL,
    "min_notice_min"           integer DEFAULT 0 NOT NULL,
    "max_horizon_days"         integer DEFAULT 60 NOT NULL,
    "slot_interval_min"        integer DEFAULT 15 NOT NULL,
    "daily_cap"                integer,
    "per_booker_cap"           integer,
    "seat_cap"                 integer DEFAULT 1 NOT NULL,
    "price_cents"              integer DEFAULT 0 NOT NULL,
    "currency"                 "text" DEFAULT 'USD' NOT NULL,
    "deposit_cents"            integer DEFAULT 0 NOT NULL,
    "deposit_refundable"       boolean DEFAULT true NOT NULL,
    "cancellation_window_min"  integer DEFAULT 0 NOT NULL,
    "reschedule_cutoff_min"    integer DEFAULT 0 NOT NULL,
    "no_show_fee_cents"        integer DEFAULT 0 NOT NULL,
    "refund_policy"            "public"."scheduling_refund_policy" DEFAULT 'full' NOT NULL,
    "allow_invitee_cancel"     boolean DEFAULT true NOT NULL,
    "allow_invitee_reschedule" boolean DEFAULT true NOT NULL,
    "schedule_id"              "uuid",
    "is_active"                boolean DEFAULT true NOT NULL,
    "sort_order"               integer DEFAULT 0 NOT NULL,
    "created_at"               timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"               timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "EventType_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EventType_visibility_chk" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'secret'::"text"]))),
    CONSTRAINT "EventType_slot_interval_chk" CHECK (("slot_interval_min" > 0)),
    CONSTRAINT "EventType_default_duration_chk" CHECK (("default_duration" > 0)),
    CONSTRAINT "EventType_seat_cap_chk" CHECK (("seat_cap" >= 1)),
    CONSTRAINT "EventType_owner_chk" CHECK (
        ("owner_type" = 'home' AND "home_id" IS NOT NULL AND "owner_user_id" IS NULL AND "owner_id" = "home_id")
        OR ("owner_type" = ANY (ARRAY['user'::"public"."scheduling_owner_type", 'business'::"public"."scheduling_owner_type"])
            AND "owner_user_id" IS NOT NULL AND "home_id" IS NULL AND "owner_id" = "owner_user_id")
    )
);
ALTER TABLE "public"."EventType" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."EventTypeAssignee" (
    "id"               "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type_id"    "uuid" NOT NULL,
    "subject_type"     "text" DEFAULT 'user' NOT NULL,
    "subject_id"       "uuid" NOT NULL,
    "weight"           integer DEFAULT 1 NOT NULL,
    "priority"         integer DEFAULT 0 NOT NULL,
    "assigned_count"   integer DEFAULT 0 NOT NULL,
    "last_assigned_at" timestamp with time zone,
    "is_active"        boolean DEFAULT true NOT NULL,
    "created_at"       timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "EventTypeAssignee_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EventTypeAssignee_subject_type_chk" CHECK (("subject_type" = ANY (ARRAY['user'::"text", 'business_team'::"text"])))
);
ALTER TABLE "public"."EventTypeAssignee" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."EventTypeQuestion" (
    "id"            "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type_id" "uuid" NOT NULL,
    "label"         "text" NOT NULL,
    "field_type"    "text" DEFAULT 'text' NOT NULL,
    "options"       "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "required"      boolean DEFAULT false NOT NULL,
    "sort_order"    integer DEFAULT 0 NOT NULL,
    "created_at"    timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "EventTypeQuestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EventTypeQuestion_field_type_chk"
        CHECK (("field_type" = ANY (ARRAY['text'::"text", 'textarea'::"text", 'select'::"text", 'multiselect'::"text", 'checkbox'::"text", 'phone'::"text"])))
);
ALTER TABLE "public"."EventTypeQuestion" OWNER TO "postgres";

-- ============================================================
-- 5. FOREIGN KEYS (idempotent)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilitySchedule_user_id_fkey') THEN
    ALTER TABLE "public"."AvailabilitySchedule"
      ADD CONSTRAINT "AvailabilitySchedule_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilityRule_schedule_id_fkey') THEN
    ALTER TABLE "public"."AvailabilityRule"
      ADD CONSTRAINT "AvailabilityRule_schedule_id_fkey"
      FOREIGN KEY ("schedule_id") REFERENCES "public"."AvailabilitySchedule"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilityOverride_schedule_id_fkey') THEN
    ALTER TABLE "public"."AvailabilityOverride"
      ADD CONSTRAINT "AvailabilityOverride_schedule_id_fkey"
      FOREIGN KEY ("schedule_id") REFERENCES "public"."AvailabilitySchedule"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilityBlock_user_id_fkey') THEN
    ALTER TABLE "public"."AvailabilityBlock"
      ADD CONSTRAINT "AvailabilityBlock_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;

  -- BookingPage owner FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingPage_owner_user_id_fkey') THEN
    ALTER TABLE "public"."BookingPage"
      ADD CONSTRAINT "BookingPage_owner_user_id_fkey"
      FOREIGN KEY ("owner_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingPage_home_id_fkey') THEN
    ALTER TABLE "public"."BookingPage"
      ADD CONSTRAINT "BookingPage_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingPage_created_by_fkey') THEN
    ALTER TABLE "public"."BookingPage"
      ADD CONSTRAINT "BookingPage_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;

  -- EventType FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventType_owner_user_id_fkey') THEN
    ALTER TABLE "public"."EventType"
      ADD CONSTRAINT "EventType_owner_user_id_fkey"
      FOREIGN KEY ("owner_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventType_home_id_fkey') THEN
    ALTER TABLE "public"."EventType"
      ADD CONSTRAINT "EventType_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventType_page_id_fkey') THEN
    ALTER TABLE "public"."EventType"
      ADD CONSTRAINT "EventType_page_id_fkey"
      FOREIGN KEY ("page_id") REFERENCES "public"."BookingPage"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventType_schedule_id_fkey') THEN
    ALTER TABLE "public"."EventType"
      ADD CONSTRAINT "EventType_schedule_id_fkey"
      FOREIGN KEY ("schedule_id") REFERENCES "public"."AvailabilitySchedule"("id") ON DELETE SET NULL;
  END IF;

  -- EventType children
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventTypeAssignee_event_type_id_fkey') THEN
    ALTER TABLE "public"."EventTypeAssignee"
      ADD CONSTRAINT "EventTypeAssignee_event_type_id_fkey"
      FOREIGN KEY ("event_type_id") REFERENCES "public"."EventType"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventTypeAssignee_subject_id_fkey') THEN
    ALTER TABLE "public"."EventTypeAssignee"
      ADD CONSTRAINT "EventTypeAssignee_subject_id_fkey"
      FOREIGN KEY ("subject_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventTypeQuestion_event_type_id_fkey') THEN
    ALTER TABLE "public"."EventTypeQuestion"
      ADD CONSTRAINT "EventTypeQuestion_event_type_id_fkey"
      FOREIGN KEY ("event_type_id") REFERENCES "public"."EventType"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 6. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "AvailabilitySchedule_user_idx" ON "public"."AvailabilitySchedule" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "AvailabilitySchedule_default_unique"
  ON "public"."AvailabilitySchedule" ("user_id") WHERE ("is_default" = true);
CREATE INDEX IF NOT EXISTS "AvailabilityRule_schedule_weekday_idx" ON "public"."AvailabilityRule" ("schedule_id", "weekday");
CREATE INDEX IF NOT EXISTS "AvailabilityOverride_schedule_date_idx" ON "public"."AvailabilityOverride" ("schedule_id", "date");
CREATE INDEX IF NOT EXISTS "AvailabilityBlock_user_time_idx" ON "public"."AvailabilityBlock" ("user_id", "start_at", "end_at");
CREATE INDEX IF NOT EXISTS "AvailabilityBlock_recurring_idx"
  ON "public"."AvailabilityBlock" ("user_id") WHERE ("recurrence_rule" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "BookingPage_slug_unique" ON "public"."BookingPage" ("lower"("slug"));
CREATE INDEX IF NOT EXISTS "BookingPage_owner_idx" ON "public"."BookingPage" ("owner_type", "owner_id");

CREATE INDEX IF NOT EXISTS "EventType_owner_idx" ON "public"."EventType" ("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "EventType_page_idx" ON "public"."EventType" ("page_id");
CREATE UNIQUE INDEX IF NOT EXISTS "EventType_page_slug_unique" ON "public"."EventType" ("page_id", "lower"("slug"));
CREATE INDEX IF NOT EXISTS "EventTypeAssignee_event_type_idx" ON "public"."EventTypeAssignee" ("event_type_id");
CREATE UNIQUE INDEX IF NOT EXISTS "EventTypeAssignee_unique" ON "public"."EventTypeAssignee" ("event_type_id", "subject_id");
CREATE INDEX IF NOT EXISTS "EventTypeQuestion_event_type_idx" ON "public"."EventTypeQuestion" ("event_type_id", "sort_order");

-- ============================================================
-- 7. ROW LEVEL SECURITY (defense-in-depth; backend uses service_role which bypasses RLS)
-- ============================================================

ALTER TABLE "public"."AvailabilitySchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AvailabilityRule"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AvailabilityOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AvailabilityBlock"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BookingPage"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EventType"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EventTypeAssignee"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EventTypeQuestion"    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "availsched_service" ON "public"."AvailabilitySchedule";
CREATE POLICY "availsched_service" ON "public"."AvailabilitySchedule" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "availsched_owner" ON "public"."AvailabilitySchedule";
CREATE POLICY "availsched_owner" ON "public"."AvailabilitySchedule" FOR SELECT USING ("user_id" = "auth"."uid"());

DROP POLICY IF EXISTS "availrule_service" ON "public"."AvailabilityRule";
CREATE POLICY "availrule_service" ON "public"."AvailabilityRule" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "availrule_owner" ON "public"."AvailabilityRule";
CREATE POLICY "availrule_owner" ON "public"."AvailabilityRule" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "public"."AvailabilitySchedule" s WHERE s."id" = "AvailabilityRule"."schedule_id" AND s."user_id" = "auth"."uid"())
);

DROP POLICY IF EXISTS "availoverride_service" ON "public"."AvailabilityOverride";
CREATE POLICY "availoverride_service" ON "public"."AvailabilityOverride" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "availoverride_owner" ON "public"."AvailabilityOverride";
CREATE POLICY "availoverride_owner" ON "public"."AvailabilityOverride" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "public"."AvailabilitySchedule" s WHERE s."id" = "AvailabilityOverride"."schedule_id" AND s."user_id" = "auth"."uid"())
);

DROP POLICY IF EXISTS "availblock_service" ON "public"."AvailabilityBlock";
CREATE POLICY "availblock_service" ON "public"."AvailabilityBlock" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "availblock_owner" ON "public"."AvailabilityBlock";
CREATE POLICY "availblock_owner" ON "public"."AvailabilityBlock" FOR SELECT USING ("user_id" = "auth"."uid"());

DROP POLICY IF EXISTS "bookingpage_service" ON "public"."BookingPage";
CREATE POLICY "bookingpage_service" ON "public"."BookingPage" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "bookingpage_read" ON "public"."BookingPage";
CREATE POLICY "bookingpage_read" ON "public"."BookingPage" FOR SELECT USING (
  "owner_user_id" = "auth"."uid"()
  OR ("owner_type" = 'home' AND "public"."home_has_permission"("home_id", 'calendar.view'::"public"."home_permission", "auth"."uid"()))
);

DROP POLICY IF EXISTS "eventtype_service" ON "public"."EventType";
CREATE POLICY "eventtype_service" ON "public"."EventType" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "eventtype_read" ON "public"."EventType";
CREATE POLICY "eventtype_read" ON "public"."EventType" FOR SELECT USING (
  "owner_user_id" = "auth"."uid"()
  OR ("owner_type" = 'home' AND "public"."home_has_permission"("home_id", 'calendar.view'::"public"."home_permission", "auth"."uid"()))
);

DROP POLICY IF EXISTS "eventtypeassignee_service" ON "public"."EventTypeAssignee";
CREATE POLICY "eventtypeassignee_service" ON "public"."EventTypeAssignee" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "eventtypeassignee_read" ON "public"."EventTypeAssignee";
CREATE POLICY "eventtypeassignee_read" ON "public"."EventTypeAssignee" FOR SELECT USING ("subject_id" = "auth"."uid"());

DROP POLICY IF EXISTS "eventtypequestion_service" ON "public"."EventTypeQuestion";
CREATE POLICY "eventtypequestion_service" ON "public"."EventTypeQuestion" FOR ALL USING ("auth"."role"() = 'service_role');

-- ============================================================
-- 8. GRANTS
-- ============================================================

GRANT ALL ON TABLE "public"."AvailabilitySchedule" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."AvailabilityRule"     TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."AvailabilityOverride" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."AvailabilityBlock"    TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."BookingPage"          TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."EventType"            TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."EventTypeAssignee"    TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."EventTypeQuestion"    TO "authenticated", "service_role";
