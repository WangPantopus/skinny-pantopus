-- 163_calendarly_group_cap.sql
-- Calendarly hardening (audit follow-ups, non-payment):
--   (1) Atomic group seat-cap enforcement. Group events (assignment_mode='group', seat_cap>1)
--       allow multiple bookings per slot up to seat_cap, so they are exempt from the
--       Booking_no_overlap exclusion constraint. A BEFORE trigger takes a transaction-scoped
--       advisory lock keyed on (event_type_id, start_at), counts active bookings, and rejects
--       overflow — closing the check-then-insert race the application pre-check cannot.
--   (2) Atomic round-robin rotation bump (single UPDATE, no read-then-write race).
-- Depends on 159 (EventType) + 160 (Booking).

CREATE OR REPLACE FUNCTION "public"."booking_enforce_group_cap"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_cap  integer;
  v_mode text;
  v_count integer;
BEGIN
  -- Only relevant for active bookings tied to an event type.
  IF NEW.event_type_id IS NULL OR NEW.status NOT IN ('pending', 'confirmed') THEN
    RETURN NEW;
  END IF;

  SELECT seat_cap, assignment_mode::text INTO v_cap, v_mode
  FROM "public"."EventType" WHERE id = NEW.event_type_id;

  -- Non-group, or group with a single seat (covered by the exclusion constraint) — nothing to do.
  IF v_mode IS DISTINCT FROM 'group' OR COALESCE(v_cap, 1) <= 1 THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent bookings for the SAME (event_type, slot) so the count+insert is atomic.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.event_type_id::text || '|' || NEW.start_at::text)::bigint);

  SELECT count(*) INTO v_count
  FROM "public"."Booking"
  WHERE event_type_id = NEW.event_type_id
    AND start_at = NEW.start_at
    AND status IN ('pending', 'confirmed')
    AND id <> NEW.id; -- exclude self (relevant on UPDATE; NEW.id is already populated on INSERT)

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'GROUP_SLOT_FULL: % of % seats taken', v_count, v_cap USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."booking_enforce_group_cap"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "booking_group_cap_trg" ON "public"."Booking";
CREATE TRIGGER "booking_group_cap_trg"
  BEFORE INSERT OR UPDATE OF "start_at", "status", "event_type_id"
  ON "public"."Booking"
  FOR EACH ROW EXECUTE FUNCTION "public"."booking_enforce_group_cap"();

-- Atomic round-robin rotation increment (replaces the service's read-then-write).
CREATE OR REPLACE FUNCTION "public"."bump_assignee_rotation"("p_event_type_id" "uuid", "p_subject_id" "uuid")
    RETURNS void
    LANGUAGE "sql"
    AS $$
  UPDATE "public"."EventTypeAssignee"
     SET assigned_count = assigned_count + 1,
         last_assigned_at = now()
   WHERE event_type_id = p_event_type_id
     AND subject_id = p_subject_id;
$$;
ALTER FUNCTION "public"."bump_assignee_rotation"("uuid", "uuid") OWNER TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."bump_assignee_rotation"("uuid", "uuid") TO "authenticated", "service_role";
