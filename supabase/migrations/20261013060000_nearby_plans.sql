-- Backwards compatible: yes. Adds two new server-only tables, "Plan" and
-- "PlanRequest" (approved by the founder on 2026-10-12 as decision D10 of the
-- Nearby Plans design), widens two ChatRoom CHECK constraints so a room can
-- have the type 'plan', widens the FunnelEvent type CHECK with seven plan_*
-- values (every existing value kept) and inserts the two Plans feature flags
-- with every switch off. No existing column, row or function changes;
-- deployed apps never read the new tables (no client grants, RLS on, no
-- policies), and every Plans route answers 404 while the flags stay off.
--
-- A plan is one Post (the public card: post_type 'event', title, content,
-- event_date, event_end_date, the public area point and area label, hidden
-- from the generic feeds by distribution_targets = {plans}) plus one Plan row.
-- The exact place (point, venue name, street address, home) lives only on
-- Plan, never on the Post, so no generic post surface can reveal it.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."Plan" (
  post_id uuid PRIMARY KEY REFERENCES public."Post"(id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('watch_party', 'playdate', 'pickup_game', 'walk_coffee')),
  -- People who can join besides the host (families for playdates).
  spots integer NOT NULL CHECK (spots BETWEEN 1 AND 30),
  -- Empty means the host approves everyone.
  auto_rules text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (auto_rules <@ ARRAY['verified', 'hosted_before', 'anyone_nearby']::text[]),
  join_requirement text NOT NULL DEFAULT 'located'
    CHECK (join_requirement IN ('located', 'verified')),
  place_kind text NOT NULL CHECK (place_kind IN ('public', 'home')),
  -- Public: the area's name ("Near Prune Hill", "Downtown Camas") and its city.
  area_label text NOT NULL CHECK (char_length(area_label) BETWEEN 1 AND 80),
  city text CHECK (city IS NULL OR char_length(city) <= 80),
  -- By kind: game {label, starts_at}, sport, level, extra_gear,
  -- kids_age_bands, walk_kind, pace, dogs_welcome.
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  -- Private: only the host and people who are in.
  guest_note text CHECK (guest_note IS NULL OR char_length(guest_note) <= 500),
  place_name text CHECK (place_name IS NULL OR char_length(place_name) <= 120),
  place_address text CHECK (place_address IS NULL OR char_length(place_address) <= 300),
  place_latitude double precision NOT NULL CHECK (place_latitude BETWEEN -90 AND 90),
  place_longitude double precision NOT NULL CHECK (place_longitude BETWEEN -180 AND 180),
  place_home_id uuid REFERENCES public."Home"(id) ON DELETE SET NULL,
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled', 'ended')),
  cancel_note text CHECK (cancel_note IS NULL OR char_length(cancel_note) <= 280),
  chat_room_id uuid REFERENCES public."ChatRoom"(id) ON DELETE SET NULL,
  chat_closed_at timestamptz,
  host_summary_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  ended_at timestamptz,
  -- Playdates meet in public places, take verified families only and are
  -- always approved by hand (decisions D4 to D7).
  CONSTRAINT plan_playdate_rules CHECK (
    kind <> 'playdate'
    OR (place_kind = 'public' AND join_requirement = 'verified' AND auto_rules = '{}'::text[])
  ),
  -- At home the host approves everyone, except people they've hosted before.
  CONSTRAINT plan_home_rules CHECK (
    place_kind <> 'home' OR auto_rules <@ ARRAY['hosted_before']::text[]
  ),
  -- Anyone nearby gets in automatically only for pickup games and walks.
  CONSTRAINT plan_anyone_nearby_kinds CHECK (
    NOT ('anyone_nearby' = ANY (auto_rules)) OR kind IN ('pickup_game', 'walk_coffee')
  ),
  CONSTRAINT plan_home_has_home CHECK (place_kind <> 'home' OR place_home_id IS NOT NULL)
);

CREATE INDEX plan_host_status_idx ON public."Plan" (host_user_id, status);
CREATE INDEX plan_status_idx ON public."Plan" (status) WHERE status = 'open';
CREATE INDEX plan_chat_room_idx ON public."Plan" (chat_room_id) WHERE chat_room_id IS NOT NULL;

ALTER TABLE public."Plan" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Plan" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."Plan" TO service_role;

CREATE TABLE public."PlanRequest" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public."Plan"(post_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'waitlisted', 'accepted', 'declined', 'withdrawn', 'left', 'removed', 'expired'
  )),
  -- 1 to 4 people; a family counts 1 at a playdate.
  party_size integer NOT NULL DEFAULT 1 CHECK (party_size BETWEEN 1 AND 4),
  -- Seen by the host only.
  note text CHECK (note IS NULL OR char_length(note) <= 280),
  -- Playdates only: how many kids and their age bands, never names.
  kids_count integer CHECK (kids_count IS NULL OR kids_count BETWEEN 1 AND 8),
  kids_age_bands text[]
    CHECK (kids_age_bands IS NULL OR kids_age_bands <@ ARRAY['under_2', '2_3', '4_5', '6_8', '9_12']::text[]),
  stays_with_kids boolean,
  decided_by text CHECK (decided_by IS NULL OR decided_by IN ('host', 'rule')),
  -- "Still coming?" after the host moves the time or the place.
  reconfirm_requested_at timestamptz,
  reconfirmed boolean,
  on_my_way_at timestamptz,
  -- Asks again after withdrawing, leaving or expiring; at most 3.
  ask_count integer NOT NULL DEFAULT 1 CHECK (ask_count BETWEEN 1 AND 3),
  -- How far the person is from the plan, as a band, for the host's view.
  distance_band text CHECK (distance_band IS NULL OR distance_band IN (
    'under_1_mi', 'about_1_mi', 'about_2_mi', 'about_3_mi', 'about_5_mi'
  )),
  -- Place in line: set on every ask; the waitlist is served oldest first.
  queued_at timestamptz NOT NULL DEFAULT now(),
  reminded_at timestamptz,
  feedback text CHECK (feedback IS NULL OR feedback IN ('great', 'ok', 'not_right')),
  feedback_note text CHECK (feedback_note IS NULL OR char_length(feedback_note) <= 500),
  feedback_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_request_one_per_person UNIQUE (post_id, user_id)
);

CREATE INDEX plan_request_user_status_idx ON public."PlanRequest" (user_id, status);
CREATE INDEX plan_request_post_status_idx ON public."PlanRequest" (post_id, status, queued_at);

ALTER TABLE public."PlanRequest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PlanRequest" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."PlanRequest" TO service_role;

-- A plan's group chat. Widening only: every existing type stays valid.
ALTER TABLE public."ChatRoom" DROP CONSTRAINT "ChatRoom_type_check";
ALTER TABLE public."ChatRoom" ADD CONSTRAINT "ChatRoom_type_check" CHECK (
  (type)::text = ANY (ARRAY['gig', 'home', 'direct', 'group', 'support_train', 'plan']::text[])
);
ALTER TABLE public."ChatRoom" DROP CONSTRAINT "ChatRoom_check";
ALTER TABLE public."ChatRoom" ADD CONSTRAINT "ChatRoom_check" CHECK (
  (((type)::text = 'gig') AND (gig_id IS NOT NULL))
  OR (((type)::text = 'home') AND (home_id IS NOT NULL))
  OR (((type)::text = 'support_train') AND (support_train_id IS NOT NULL))
  OR ((type)::text = ANY (ARRAY['direct', 'group', 'plan']::text[]))
);

-- Plans funnel. Every existing value is kept.
ALTER TABLE public."FunnelEvent" DROP CONSTRAINT funnelevent_type_check;
ALTER TABLE public."FunnelEvent" ADD CONSTRAINT funnelevent_type_check CHECK (
  event_type IN (
    't0_preview_viewed', 't0_aha_viewed', 't0_share_clicked',
    't0_wall_viewed', 'register_started', 't1_account_created',
    'session_open', 'reminder_sent', 'reminder_action', 'suggestion_decision',
    'plan_viewed', 'plan_created', 'plan_requested', 'plan_accepted',
    'plan_attended', 'plan_hosted_again', 'plan_share_opened'
  )
);

-- Both off for everyone. The founder turns them on (internal team or beta
-- users first) from the admin flag route once the journeys pass.
INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES
  ('plans', false, false, ARRAY[]::uuid[],
   'Nearby Plans: Nearby opens on the map, hosting and joining plans, their notifications and the web share page. Off until the founder turns it on.'),
  ('plans_playdates', false, false, ARRAY[]::uuid[],
   'Nearby Plans playdates, on top of plans. Off until address verification works in production and a lawyer has read the rules (decision D4).')
ON CONFLICT (flag_name) DO NOTHING;

COMMIT;
