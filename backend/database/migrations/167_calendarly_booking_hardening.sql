-- 167_calendarly_booking_hardening.sql
-- Audit follow-ups (2026-08 branch audit):
--   (1) Booking.ics_sequence — a real monotonic iTIP revision counter. Both ICS emitters
--       previously computed SEQUENCE as `previous_start_at ? 1 : 0`, so the second and every
--       later reschedule re-issued SEQUENCE:1 and calendar clients ignored the update.
--   (2) Atomic daily-cap enforcement for EventType.daily_cap. The column existed but nothing
--       read it; the application pre-check added alongside this migration is check-then-act,
--       so a trigger (advisory-lock + count, modeled on booking_enforce_group_cap) closes the
--       race. The cap day is defined as the UTC date of start_at — the same definition the
--       application check and the slot grid use, so all three layers agree.
-- Depends on 159 (EventType) + 160 (Booking).

ALTER TABLE "public"."Booking"
  ADD COLUMN IF NOT EXISTS "ics_sequence" integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION "public"."booking_enforce_daily_cap"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_cap integer;
  v_count integer;
  v_day date;
BEGIN
  IF NEW.event_type_id IS NULL OR NEW.status NOT IN ('pending', 'confirmed') THEN
    RETURN NEW;
  END IF;

  SELECT daily_cap INTO v_cap FROM "public"."EventType" WHERE id = NEW.event_type_id;
  IF COALESCE(v_cap, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  v_day := (NEW.start_at AT TIME ZONE 'UTC')::date;

  -- Serialize concurrent bookings for the same (event_type, UTC day).
  PERFORM pg_advisory_xact_lock(hashtext(NEW.event_type_id::text || '|day|' || v_day::text)::bigint);

  SELECT count(*) INTO v_count
  FROM "public"."Booking"
  WHERE event_type_id = NEW.event_type_id
    AND (start_at AT TIME ZONE 'UTC')::date = v_day
    AND status IN ('pending', 'confirmed')
    AND id <> NEW.id;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'DAILY_CAP_REACHED: % of % bookings taken', v_count, v_cap USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."booking_enforce_daily_cap"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "booking_daily_cap_trg" ON "public"."Booking";
CREATE TRIGGER "booking_daily_cap_trg"
  BEFORE INSERT OR UPDATE OF "start_at", "status", "event_type_id"
  ON "public"."Booking"
  FOR EACH ROW EXECUTE FUNCTION "public"."booking_enforce_daily_cap"();

-- (3) Reconcile Booking_resource_id_fkey (ON DELETE SET NULL, migration 160) with
--     Booking_event_or_resource_chk (migration 162). The API only soft-deletes resources,
--     but hard deletes still happen through cascade chains (home/user deletion cascades into
--     HomeResource) — and SET NULL on a resource-ONLY booking violates the CHECK, aborting
--     the whole parent deletion. Resource-only bookings die with their resource; bookings
--     that also carry an event type just lose the room via the existing SET NULL.
CREATE OR REPLACE FUNCTION "public"."resource_predelete_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM "public"."Booking" WHERE "resource_id" = OLD."id" AND "event_type_id" IS NULL;
  RETURN OLD;
END;
$$;
ALTER FUNCTION "public"."resource_predelete_cleanup"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "homeresource_predelete_trg" ON "public"."HomeResource";
CREATE TRIGGER "homeresource_predelete_trg"
  BEFORE DELETE ON "public"."HomeResource"
  FOR EACH ROW EXECUTE FUNCTION "public"."resource_predelete_cleanup"();

-- (4) Collective co-host reservations. For assignment_mode='collective' the service now writes
--     one sibling Booking row per required co-host, linked here to the primary row. Sibling
--     rows exist because BOTH overlap guards key on host_user_id (the Booking_no_overlap
--     exclusion constraint and the availability engine's busy query) and neither can see
--     BookingAttendee rows — so co-hosts' time stayed bookable everywhere else. CASCADE makes
--     siblings die with their primary (including the payment-failure rollback delete).
ALTER TABLE "public"."Booking"
  ADD COLUMN IF NOT EXISTS "cohost_of_booking_id" "uuid";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_cohost_of_booking_id_fkey') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_cohost_of_booking_id_fkey"
      FOREIGN KEY ("cohost_of_booking_id") REFERENCES "public"."Booking"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Booking_cohost_of_idx"
  ON "public"."Booking" ("cohost_of_booking_id") WHERE ("cohost_of_booking_id" IS NOT NULL);

-- Sibling rows are shadows of ONE meeting, not additional bookings, so they must not consume
-- daily-cap headroom (a 3-host collective meeting would otherwise count as 3 bookings and
-- the sibling inserts themselves could trip the cap). Supersedes the (2) definition above:
-- identical body plus the cohost exemption + count filter.
CREATE OR REPLACE FUNCTION "public"."booking_enforce_daily_cap"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_cap integer;
  v_count integer;
  v_day date;
BEGIN
  -- Co-host reservation shadows mirror their primary row; the primary already consumed the cap.
  IF NEW.cohost_of_booking_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type_id IS NULL OR NEW.status NOT IN ('pending', 'confirmed') THEN
    RETURN NEW;
  END IF;

  SELECT daily_cap INTO v_cap FROM "public"."EventType" WHERE id = NEW.event_type_id;
  IF COALESCE(v_cap, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  v_day := (NEW.start_at AT TIME ZONE 'UTC')::date;

  -- Serialize concurrent bookings for the same (event_type, UTC day).
  PERFORM pg_advisory_xact_lock(hashtext(NEW.event_type_id::text || '|day|' || v_day::text)::bigint);

  SELECT count(*) INTO v_count
  FROM "public"."Booking"
  WHERE event_type_id = NEW.event_type_id
    AND (start_at AT TIME ZONE 'UTC')::date = v_day
    AND status IN ('pending', 'confirmed')
    AND cohost_of_booking_id IS NULL
    AND id <> NEW.id;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'DAILY_CAP_REACHED: % of % bookings taken', v_count, v_cap USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- (5) Wall-clock timezone for recurring busy series. RRULE expansion previously iterated bare
--     UTC instants, so an "every Monday 09:00" AvailabilityBlock / HomeCalendarEvent drifted
--     by an hour after each DST change (09:00 became 08:00 or 10:00 local). The engine now
--     expands each series in this zone; NULL keeps the legacy plain-UTC behavior for
--     pre-existing rows. Defaulted on write from the creator's schedule timezone.
ALTER TABLE "public"."AvailabilityBlock"
  ADD COLUMN IF NOT EXISTS "timezone" "text";

ALTER TABLE "public"."HomeCalendarEvent"
  ADD COLUMN IF NOT EXISTS "timezone" "text";
