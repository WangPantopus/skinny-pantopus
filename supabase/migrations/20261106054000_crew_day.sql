-- Backwards compatible: yes. Adds three new server-only tables, "CrewDay",
-- "CrewDayBooking" and "CrewDayEvent" (approved by the founder on 2026-11-05 for
-- the Crew Day build, docs/product/crew-day-build/02-contract.md §2), and one
-- trigger on the new booking table that keeps a street day from taking more
-- homes than its capacity. No existing table, column, row or function changes;
-- deployed apps never read the new tables (RLS on, no policies, no client
-- grants), and every Crew Day route answers 403 CREW_DAY_UNAVAILABLE while the
-- launch-cut key `crew_day` is unlisted, so the tables stay empty in production
-- until the founder lists it.
--
-- A CrewDay row is either a crew's street day (kind 'offer') or a household's
-- "Ask for a Crew Day on my street" (kind 'request'). A booking is one home on a
-- crew's route; each charge is an existing BusinessInvoice made when the crew
-- marks the home done. Events are the append-only timeline both sides and the
-- operator read.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."CrewDay" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('offer', 'request')),
  -- The crew's business account (offers only).
  business_user_id uuid REFERENCES public."User"(id) ON DELETE CASCADE,
  -- The crew member who set it up, or the household that asked. Kept when that
  -- account goes, so a business's day never disappears with a team member.
  created_by uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  service text NOT NULL CHECK (service IN (
    'gutter_cleaning', 'leaf_cleanup', 'roof_moss', 'holiday_lights', 'window_washing', 'pressure_washing', 'other'
  )),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  street_label text NOT NULL CHECK (char_length(street_label) BETWEEN 1 AND 80),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 80),
  state text NOT NULL CHECK (char_length(state) BETWEEN 1 AND 40),
  -- The area's center: never shown to households.
  center_latitude double precision NOT NULL CHECK (center_latitude BETWEEN -90 AND 90),
  center_longitude double precision NOT NULL CHECK (center_longitude BETWEEN -180 AND 180),
  radius_m integer CHECK (radius_m IS NULL OR radius_m BETWEEN 100 AND 1600),
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  service_date date,
  -- The arrival window, local to timezone.
  window_start time,
  window_end time,
  capacity integer CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 60),
  booking_closes_at timestamptz,
  included text[] NOT NULL DEFAULT '{}'::text[] CHECK (cardinality(included) <= 6),
  outside_only boolean NOT NULL DEFAULT true,
  prep_note text CHECK (prep_note IS NULL OR char_length(prep_note) <= 500),
  -- [{ id, label, price_cents (null when needs_look), needs_look }], 1 to 6.
  price_options jsonb CHECK (
    price_options IS NULL
    OR (jsonb_typeof(price_options) = 'array' AND jsonb_array_length(price_options) BETWEEN 1 AND 6)
  ),
  -- [{ id, label, price_cents }], 0 to 4.
  add_ons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(add_ons) = 'array' AND jsonb_array_length(add_ons) <= 4
  ),
  -- The invitation link's code: 8 characters without look-alikes (no 0, 1, i, l, o).
  share_code text UNIQUE CHECK (share_code IS NULL OR share_code ~ '^[a-hjkmnp-z2-9]{8}$'),
  status text NOT NULL,
  submitted_at timestamptz,
  -- The operator's approval or decline, or the operator's answer to a request.
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 500),
  reviewed_by uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  cancel_reason text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 500),
  cancelled_by text CHECK (cancelled_by IS NULL OR cancelled_by IN ('crew', 'operator')),
  cancelled_by_user_id uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  -- The open rain proposal: { id, dates: [{ date, window_start, window_end }], deadline_at, note, sent_at }.
  proposed_dates jsonb CHECK (proposed_dates IS NULL OR jsonb_typeof(proposed_dates) = 'object'),
  -- Requests: ["2026-12", ...] or ["any"], the household's note and home.
  request_months text[] CHECK (request_months IS NULL OR cardinality(request_months) BETWEEN 1 AND 7),
  request_note text CHECK (request_note IS NULL OR char_length(request_note) <= 500),
  -- No foreign key on purpose (like Plan.place_home_id): Home deletion stays governed
  -- by its explicit policy (home_delete_eligibility), which this table doesn't join.
  request_home_id uuid,
  fulfilled_by uuid REFERENCES public."CrewDay"(id) ON DELETE SET NULL,
  repeat_of uuid REFERENCES public."CrewDay"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT crew_day_status_by_kind CHECK (
    (kind = 'offer' AND status IN ('draft', 'pending_review', 'declined', 'open', 'in_progress', 'done', 'cancelled'))
    OR (kind = 'request' AND status IN ('requested', 'offer_ready', 'no_crew'))
  ),
  CONSTRAINT crew_day_offer_complete CHECK (
    kind <> 'offer' OR (
      business_user_id IS NOT NULL AND radius_m IS NOT NULL AND service_date IS NOT NULL
      AND window_start IS NOT NULL AND window_end IS NOT NULL AND window_end > window_start
      AND capacity IS NOT NULL AND booking_closes_at IS NOT NULL AND price_options IS NOT NULL
      AND share_code IS NOT NULL
    )
  ),
  CONSTRAINT crew_day_request_complete CHECK (
    kind <> 'request' OR (business_user_id IS NULL AND request_months IS NOT NULL)
  )
);

CREATE INDEX crew_day_business_status_idx ON public."CrewDay" (business_user_id, status) WHERE kind = 'offer';
CREATE INDEX crew_day_offer_status_date_idx ON public."CrewDay" (status, service_date) WHERE kind = 'offer';
CREATE INDEX crew_day_request_status_idx ON public."CrewDay" (status, created_at) WHERE kind = 'request';
CREATE INDEX crew_day_created_by_idx ON public."CrewDay" (created_by, kind);

ALTER TABLE public."CrewDay" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."CrewDay" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."CrewDay" TO service_role;

CREATE TABLE public."CrewDayBooking" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_day_id uuid NOT NULL REFERENCES public."CrewDay"(id) ON DELETE CASCADE,
  household_user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  -- No foreign key on purpose (see CrewDay.request_home_id).
  home_id uuid,
  -- The address the crew sees in the job window.
  address_line text NOT NULL CHECK (char_length(address_line) BETWEEN 1 AND 200),
  address_city text CHECK (address_city IS NULL OR char_length(address_city) <= 80),
  address_state text CHECK (address_state IS NULL OR char_length(address_state) <= 40),
  address_zip text CHECK (address_zip IS NULL OR char_length(address_zip) <= 20),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  option_id text NOT NULL CHECK (char_length(option_id) BETWEEN 1 AND 40),
  add_on_ids text[] NOT NULL DEFAULT '{}'::text[] CHECK (cardinality(add_on_ids) <= 4),
  -- What was booked, as priced when booked: [{ kind: option|add_on, id, label, price_cents }].
  -- Later edits to the day's price list never change it.
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(line_items) = 'array'),
  price_cents integer CHECK (price_cents IS NULL OR price_cents > 0),
  status text NOT NULL CHECK (status IN (
    'price_pending', 'price_offered', 'booked', 'new_dates', 'on_the_way', 'done', 'paid', 'payment_failed',
    'refunded', 'cancelled', 'declined'
  )),
  -- The booking's own day (rain can split a Crew Day across dates).
  service_date date NOT NULL,
  window_start time NOT NULL,
  window_end time NOT NULL CHECK (window_end > window_start),
  eta_start timestamptz,
  eta_end timestamptz,
  eta_updated_at timestamptz,
  route_position integer,
  -- Crew-visible in the job window only; cleared 7 days after the booking ends.
  access_note text CHECK (access_note IS NULL OR char_length(access_note) <= 500),
  gate_ready_at timestamptz,
  cant_get_in_at timestamptz,
  -- The household's saved Stripe payment method, checked at booking.
  payment_method_id text CHECK (payment_method_id IS NULL OR char_length(payment_method_id) <= 255),
  reminder_sent_at timestamptz,
  release_asked_at timestamptz,
  done_at timestamptz,
  done_by uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  done_note text CHECK (done_note IS NULL OR char_length(done_note) <= 500),
  photo_paths text[] NOT NULL DEFAULT '{}'::text[] CHECK (cardinality(photo_paths) <= 8),
  charge_due_at timestamptz,
  household_confirmed_at timestamptz,
  invoice_id uuid REFERENCES public."BusinessInvoice"(id) ON DELETE SET NULL,
  -- The charge job claims a booking before charging it, so overlapping runs never charge twice.
  charge_claimed_at timestamptz,
  charge_attempts integer NOT NULL DEFAULT 0 CHECK (charge_attempts >= 0),
  charge_failure text CHECK (charge_failure IS NULL OR char_length(charge_failure) <= 80),
  paid_at timestamptz,
  problem_status text CHECK (problem_status IS NULL OR problem_status IN ('open', 'resolved')),
  problem_kind text CHECK (problem_kind IS NULL OR problem_kind IN ('missed', 'damage', 'no_show', 'charge', 'other')),
  problem_note text CHECK (problem_note IS NULL OR char_length(problem_note) <= 1000),
  problem_photo_paths text[] NOT NULL DEFAULT '{}'::text[] CHECK (cardinality(problem_photo_paths) <= 4),
  problem_opened_at timestamptz,
  problem_due_at timestamptz,
  problem_resolved_at timestamptz,
  problem_resolution text CHECK (problem_resolution IS NULL OR problem_resolution IN (
    'released', 'refunded', 'partial_refund', 'resolved'
  )),
  refunded_cents integer NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  -- { proposal_id, date or "cancel", answered_at }
  new_date_choice jsonb CHECK (new_date_choice IS NULL OR jsonb_typeof(new_date_choice) = 'object'),
  remind_next_season boolean NOT NULL DEFAULT false,
  cancelled_by text CHECK (cancelled_by IS NULL OR cancelled_by IN ('household', 'crew', 'operator', 'system')),
  cancelled_at timestamptz,
  cancel_reason text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 500),
  -- Idempotent booking: a retry with the same id answers with the same booking.
  client_request_id text CHECK (client_request_id IS NULL OR char_length(client_request_id) BETWEEN 8 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crew_day_booking_priced CHECK (
    price_cents IS NOT NULL OR status IN ('price_pending', 'declined', 'cancelled')
  )
);

-- One active booking per household per Crew Day.
CREATE UNIQUE INDEX crew_day_booking_one_active_idx ON public."CrewDayBooking" (crew_day_id, household_user_id)
  WHERE status NOT IN ('cancelled', 'declined', 'refunded');
CREATE UNIQUE INDEX crew_day_booking_client_request_idx ON public."CrewDayBooking" (household_user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE INDEX crew_day_booking_day_status_idx ON public."CrewDayBooking" (crew_day_id, status);
CREATE INDEX crew_day_booking_household_idx ON public."CrewDayBooking" (household_user_id, status);
CREATE INDEX crew_day_booking_charge_due_idx ON public."CrewDayBooking" (charge_due_at) WHERE status = 'done';
CREATE INDEX crew_day_booking_invoice_idx ON public."CrewDayBooking" (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX crew_day_booking_problem_idx ON public."CrewDayBooking" (problem_due_at) WHERE problem_status = 'open';

ALTER TABLE public."CrewDayBooking" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."CrewDayBooking" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."CrewDayBooking" TO service_role;

CREATE TABLE public."CrewDayEvent" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_day_id uuid NOT NULL REFERENCES public."CrewDay"(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public."CrewDayBooking"(id) ON DELETE CASCADE,
  -- Null for the system.
  actor_user_id uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('household', 'crew', 'operator', 'system')),
  kind text NOT NULL CHECK (kind ~ '^[a-z_]{3,40}$'),
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  visible_to text NOT NULL CHECK (visible_to IN ('household', 'crew', 'both', 'operator')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crew_day_event_day_idx ON public."CrewDayEvent" (crew_day_id, created_at);
CREATE INDEX crew_day_event_booking_idx ON public."CrewDayEvent" (booking_id, created_at) WHERE booking_id IS NOT NULL;
CREATE INDEX crew_day_event_actor_kind_idx ON public."CrewDayEvent" (actor_user_id, kind);

ALTER TABLE public."CrewDayEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."CrewDayEvent" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."CrewDayEvent" TO service_role;

-- A street day never takes more homes than its capacity, even when the last spot
-- is booked twice at once: the day's row is locked while the active bookings are
-- counted, so concurrent bookings for one day wait for each other. Only an open
-- or started offer takes bookings. The server answers these with its own codes
-- (DAY_FULL, DAY_NOT_OPEN).
CREATE FUNCTION public.crew_day_booking_admit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  day_kind text;
  day_status text;
  day_capacity integer;
  taken integer;
BEGIN
  IF NEW.status IN ('cancelled', 'declined', 'refunded') THEN
    RETURN NEW;
  END IF;
  SELECT kind, status, capacity INTO day_kind, day_status, day_capacity
    FROM public."CrewDay" WHERE id = NEW.crew_day_id FOR UPDATE;
  IF NOT FOUND OR day_kind <> 'offer' OR day_status NOT IN ('open', 'in_progress') THEN
    RAISE EXCEPTION 'CREW_DAY_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO taken FROM public."CrewDayBooking"
    WHERE crew_day_id = NEW.crew_day_id AND status NOT IN ('cancelled', 'declined', 'refunded');
  IF taken >= day_capacity THEN
    RAISE EXCEPTION 'CREW_DAY_FULL' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.crew_day_booking_admit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER crew_day_booking_admit
  BEFORE INSERT ON public."CrewDayBooking"
  FOR EACH ROW EXECUTE FUNCTION public.crew_day_booking_admit();

COMMIT;
