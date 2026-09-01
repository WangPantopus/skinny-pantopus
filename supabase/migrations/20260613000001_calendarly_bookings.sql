-- 160_calendarly_bookings.sql
-- Calendarly — bookings, attendees, manage/one-off tokens, home resources, and the Payment link.
-- Depends on 159 (enums + EventType + BookingPage + AvailabilitySchedule).
--
-- Atomic double-book prevention: a buffer-padded GiST exclusion constraint on Booking guarantees
-- no two active (pending/confirmed) bookings for the same host overlap. Application re-checks are
-- not atomic under concurrency; this constraint is the source of truth. Group events (seat_cap > 1)
-- set enforce_exclusive = false so multiple invitees can share a slot up to capacity.

-- Required for the exclusion constraint (host_user_id WITH = + tstzrange WITH &&).
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================
-- 1. HomeResource — bookable household resources (room / vehicle / tool / charger)
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeResource" (
    "id"                "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id"           "uuid" NOT NULL,
    "name"              "text" NOT NULL,
    "resource_type"     "text" DEFAULT 'other' NOT NULL,
    "photo_url"         "text",
    "who_can_book"      "text" DEFAULT 'members' NOT NULL,
    "max_duration_min"  integer,
    "buffer_min"        integer DEFAULT 0 NOT NULL,
    "requires_approval" boolean DEFAULT false NOT NULL,
    "available_hours"   "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active"         boolean DEFAULT true NOT NULL,
    "created_by"        "uuid",
    "created_at"        timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"        timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeResource_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomeResource_type_chk"
        CHECK (("resource_type" = ANY (ARRAY['room'::"text", 'vehicle'::"text", 'tool'::"text", 'charger'::"text", 'other'::"text"]))),
    CONSTRAINT "HomeResource_who_can_book_chk"
        CHECK (("who_can_book" = ANY (ARRAY['members'::"text", 'specific'::"text", 'guests'::"text"])))
);
ALTER TABLE "public"."HomeResource" OWNER TO "postgres";

-- ============================================================
-- 2. Booking — a pending/confirmed slot with an invitee
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."Booking" (
    "id"                          "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type_id"               "uuid" NOT NULL,
    "owner_type"                  "public"."scheduling_owner_type" NOT NULL,
    "owner_id"                    "uuid" NOT NULL,
    "owner_user_id"               "uuid",
    "home_id"                     "uuid",
    "page_id"                     "uuid",
    "host_user_id"                "uuid",
    "invitee_user_id"             "uuid",
    "invitee_name"                "text",
    "invitee_email"               "text",
    "invitee_phone"               "text",
    "invitee_timezone"            "text",
    "start_at"                    timestamp with time zone NOT NULL,
    "end_at"                      timestamp with time zone NOT NULL,
    "status"                      "public"."booking_status" DEFAULT 'pending' NOT NULL,
    "location_mode"               "public"."scheduling_location_mode",
    "location_detail"             "text",
    "intake_answers"              "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "policy_snapshot"             "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rescheduled_from_booking_id" "uuid",
    "previous_start_at"           timestamp with time zone,
    "recurrence_group_id"         "uuid",
    "resource_id"                 "uuid",
    "payment_id"                  "uuid",
    "package_credit_id"           "uuid",
    "buffer_before_min"           integer DEFAULT 0 NOT NULL,
    "buffer_after_min"            integer DEFAULT 0 NOT NULL,
    "guard_start"                 timestamp with time zone,
    "guard_end"                   timestamp with time zone,
    "enforce_exclusive"           boolean DEFAULT true NOT NULL,
    "created_via"                 "text" DEFAULT 'public_link' NOT NULL,
    "cancel_reason"               "text",
    "cancelled_by"                "uuid",
    "created_by"                  "uuid",
    "created_at"                  timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"                  timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Booking_time_chk" CHECK (("end_at" > "start_at")),
    CONSTRAINT "Booking_created_via_chk"
        CHECK (("created_via" = ANY (ARRAY['public_link'::"text", 'in_app'::"text", 'manual'::"text", 'one_off'::"text"]))),
    CONSTRAINT "Booking_owner_chk" CHECK (
        ("owner_type" = 'home' AND "home_id" IS NOT NULL AND "owner_user_id" IS NULL AND "owner_id" = "home_id")
        OR ("owner_type" = ANY (ARRAY['user'::"public"."scheduling_owner_type", 'business'::"public"."scheduling_owner_type"])
            AND "owner_user_id" IS NOT NULL AND "home_id" IS NULL AND "owner_id" = "owner_user_id")
    )
);
ALTER TABLE "public"."Booking" OWNER TO "postgres";

-- ============================================================
-- 3. BookingAttendee — group seats / collective required members / home RSVP
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."BookingAttendee" (
    "id"          "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id"  "uuid" NOT NULL,
    "user_id"     "uuid",
    "name"        "text",
    "email"       "text",
    "rsvp_status" "public"."booking_rsvp_status" DEFAULT 'pending' NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "created_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BookingAttendee_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."BookingAttendee" OWNER TO "postgres";

-- ============================================================
-- 4. BookingToken — manage links + one-off links (crypto.randomBytes -> sha256 hash)
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."BookingToken" (
    "id"            "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id"    "uuid",
    "event_type_id" "uuid",
    "token_hash"    "text" NOT NULL,
    "kind"          "public"."booking_token_kind" NOT NULL,
    "expires_at"    timestamp with time zone,
    "single_use"    boolean DEFAULT true NOT NULL,
    "consumed_at"   timestamp with time zone,
    "created_at"    timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BookingToken_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."BookingToken" OWNER TO "postgres";

-- ============================================================
-- 5. FOREIGN KEYS (idempotent)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HomeResource_home_id_fkey') THEN
    ALTER TABLE "public"."HomeResource"
      ADD CONSTRAINT "HomeResource_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_event_type_id_fkey') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_event_type_id_fkey"
      FOREIGN KEY ("event_type_id") REFERENCES "public"."EventType"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_owner_user_id_fkey') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_owner_user_id_fkey"
      FOREIGN KEY ("owner_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_home_id_fkey') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_page_id_fkey') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_page_id_fkey"
      FOREIGN KEY ("page_id") REFERENCES "public"."BookingPage"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_host_user_id_fkey') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_host_user_id_fkey"
      FOREIGN KEY ("host_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_invitee_user_id_fkey') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_invitee_user_id_fkey"
      FOREIGN KEY ("invitee_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_rescheduled_from_fkey') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_rescheduled_from_fkey"
      FOREIGN KEY ("rescheduled_from_booking_id") REFERENCES "public"."Booking"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_resource_id_fkey') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_resource_id_fkey"
      FOREIGN KEY ("resource_id") REFERENCES "public"."HomeResource"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_payment_id_fkey') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_payment_id_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "public"."Payment"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingAttendee_booking_id_fkey') THEN
    ALTER TABLE "public"."BookingAttendee"
      ADD CONSTRAINT "BookingAttendee_booking_id_fkey"
      FOREIGN KEY ("booking_id") REFERENCES "public"."Booking"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingAttendee_user_id_fkey') THEN
    ALTER TABLE "public"."BookingAttendee"
      ADD CONSTRAINT "BookingAttendee_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingToken_booking_id_fkey') THEN
    ALTER TABLE "public"."BookingToken"
      ADD CONSTRAINT "BookingToken_booking_id_fkey"
      FOREIGN KEY ("booking_id") REFERENCES "public"."Booking"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingToken_event_type_id_fkey') THEN
    ALTER TABLE "public"."BookingToken"
      ADD CONSTRAINT "BookingToken_event_type_id_fkey"
      FOREIGN KEY ("event_type_id") REFERENCES "public"."EventType"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 6. INDEXES + the buffer-padded overlap exclusion constraint
-- ============================================================

CREATE INDEX IF NOT EXISTS "HomeResource_home_idx" ON "public"."HomeResource" ("home_id");

CREATE INDEX IF NOT EXISTS "Booking_owner_start_idx" ON "public"."Booking" ("owner_type", "owner_id", "start_at" DESC);
CREATE INDEX IF NOT EXISTS "Booking_host_start_idx" ON "public"."Booking" ("host_user_id", "start_at");
CREATE INDEX IF NOT EXISTS "Booking_invitee_user_start_idx" ON "public"."Booking" ("invitee_user_id", "start_at");
CREATE INDEX IF NOT EXISTS "Booking_invitee_email_start_idx" ON "public"."Booking" ("lower"("invitee_email"), "start_at");
CREATE INDEX IF NOT EXISTS "Booking_event_type_start_idx" ON "public"."Booking" ("event_type_id", "start_at");
CREATE INDEX IF NOT EXISTS "Booking_resource_start_idx" ON "public"."Booking" ("resource_id", "start_at") WHERE ("resource_id" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "Booking_active_start_idx"
  ON "public"."Booking" ("start_at") WHERE ("status" = ANY (ARRAY['pending'::"public"."booking_status", 'confirmed'::"public"."booking_status"]));

CREATE INDEX IF NOT EXISTS "BookingAttendee_booking_idx" ON "public"."BookingAttendee" ("booking_id");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingAttendee_unique" ON "public"."BookingAttendee" ("booking_id", "user_id") WHERE ("user_id" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "BookingToken_hash_unique" ON "public"."BookingToken" ("token_hash");

-- guard_start/guard_end hold the buffer-padded range. A trigger keeps them in sync so the
-- exclusion constraint can reference plain (immutable) columns — timestamptz +/- interval is
-- STABLE (timezone-dependent) and cannot appear directly in an index/constraint expression.
CREATE OR REPLACE FUNCTION "public"."booking_set_guard_range"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Occupied range = prep (buffer_before) before the start, wind-down (buffer_after) after the end.
  NEW.guard_start := NEW.start_at - "make_interval"("mins" => COALESCE(NEW.buffer_before_min, 0));
  NEW.guard_end   := NEW.end_at   + "make_interval"("mins" => COALESCE(NEW.buffer_after_min, 0));
  RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."booking_set_guard_range"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "booking_guard_range_trg" ON "public"."Booking";
CREATE TRIGGER "booking_guard_range_trg"
  BEFORE INSERT OR UPDATE OF "start_at", "end_at", "buffer_before_min", "buffer_after_min"
  ON "public"."Booking"
  FOR EACH ROW EXECUTE FUNCTION "public"."booking_set_guard_range"();

-- Atomic, buffer-aware no-overlap guard for a single host's active bookings.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_no_overlap') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_no_overlap"
      EXCLUDE USING gist (
        "host_user_id" WITH =,
        "tstzrange"("guard_start", "guard_end") WITH &&
      )
      WHERE (
        "status" = ANY (ARRAY['pending'::"public"."booking_status", 'confirmed'::"public"."booking_status"])
        AND "host_user_id" IS NOT NULL
        AND "enforce_exclusive" = true
        AND "guard_start" IS NOT NULL
        AND "guard_end" IS NOT NULL
      );
  END IF;
END $$;

-- ============================================================
-- 7. Payment link (no new payment tables — extend the existing Payment)
-- ============================================================

ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "booking_id" "uuid";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_booking_id_fkey') THEN
    ALTER TABLE "public"."Payment"
      ADD CONSTRAINT "Payment_booking_id_fkey"
      FOREIGN KEY ("booking_id") REFERENCES "public"."Booking"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Payment_booking_idx" ON "public"."Payment" ("booking_id") WHERE ("booking_id" IS NOT NULL);

-- Extend the Payment.payment_type CHECK to allow booking + package payments.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_payment_type_check') THEN
    ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_payment_type_check";
  END IF;
  ALTER TABLE "public"."Payment"
    ADD CONSTRAINT "Payment_payment_type_check"
    CHECK ((("payment_type")::"text" = ANY (ARRAY[
      'gig_payment'::"text", 'tip'::"text", 'cancellation_fee'::"text",
      'booking_payment'::"text", 'package_payment'::"text"
    ])));
END $$;

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE "public"."HomeResource"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Booking"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BookingAttendee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BookingToken"    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "homeresource_service" ON "public"."HomeResource";
CREATE POLICY "homeresource_service" ON "public"."HomeResource" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "homeresource_read" ON "public"."HomeResource";
CREATE POLICY "homeresource_read" ON "public"."HomeResource" FOR SELECT USING (
  "public"."home_has_permission"("home_id", 'calendar.view'::"public"."home_permission", "auth"."uid"())
);

DROP POLICY IF EXISTS "booking_service" ON "public"."Booking";
CREATE POLICY "booking_service" ON "public"."Booking" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "booking_read" ON "public"."Booking";
CREATE POLICY "booking_read" ON "public"."Booking" FOR SELECT USING (
  "owner_user_id" = "auth"."uid"()
  OR "host_user_id" = "auth"."uid"()
  OR "invitee_user_id" = "auth"."uid"()
  OR ("owner_type" = 'home' AND "public"."home_has_permission"("home_id", 'calendar.view'::"public"."home_permission", "auth"."uid"()))
);

DROP POLICY IF EXISTS "bookingattendee_service" ON "public"."BookingAttendee";
CREATE POLICY "bookingattendee_service" ON "public"."BookingAttendee" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "bookingattendee_read" ON "public"."BookingAttendee";
CREATE POLICY "bookingattendee_read" ON "public"."BookingAttendee" FOR SELECT USING ("user_id" = "auth"."uid"());

DROP POLICY IF EXISTS "bookingtoken_service" ON "public"."BookingToken";
CREATE POLICY "bookingtoken_service" ON "public"."BookingToken" FOR ALL USING ("auth"."role"() = 'service_role');

-- ============================================================
-- 9. GRANTS
-- ============================================================

GRANT ALL ON TABLE "public"."HomeResource"    TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."Booking"         TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."BookingAttendee" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."BookingToken"    TO "authenticated", "service_role";
