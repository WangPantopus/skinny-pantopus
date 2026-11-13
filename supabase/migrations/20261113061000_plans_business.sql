-- Backwards compatible: yes. Added nullable or defaulted columns, checks widened so that every existing row still
-- passes, two feature flags that start off, and role defaults for two new permissions. Deployed apps and the
-- current server never write the new columns, and a neighbor's plan is a row with all of them empty.
--
-- Plans with businesses, step 2 (docs/product/plans-with-businesses; the founder's go on 2026-11-12): a verified
-- business hosts a free plan at one of its own locations. Everything is behind plans_business, which starts off.
--
--   Plan.business_user_id      the business hosting. Null on a neighbor's plan. A business's plan has the business
--                              itself as its host (host_user_id), so every screen, notice and chat line names the
--                              business with no special case, and a missed code path cannot name a staff member.
--   Plan.posted_by_user_id     the staff member who posted it. Sent only to the business's own team.
--   Plan.business_location_id  the business location it is at (no foreign key: the plan keeps its own copy of
--                              the name, address and point, as place_home_id does).
--   Plan.label                 what the business calls it ("clinic", "open_play"), from a fixed list per kind.
--   Plan.guests_can_invite     "Bring a friend". Only on a business's plan.
--   PlanRequest.way_in         how the guest arrived, saved when they join a business's plan.
--
-- Deploy this migration before the backend that reads these columns.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."Plan"
  ADD COLUMN IF NOT EXISTS business_user_id uuid REFERENCES public."User"(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS posted_by_user_id uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_location_id uuid,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS guests_can_invite boolean NOT NULL DEFAULT false;

-- The business is the host of its own plan.
ALTER TABLE public."Plan" DROP CONSTRAINT IF EXISTS plan_business_is_host;
ALTER TABLE public."Plan" ADD CONSTRAINT plan_business_is_host
  CHECK (business_user_id IS NULL OR business_user_id = host_user_id);
-- A business never hosts at a home, and always at one of its own locations.
ALTER TABLE public."Plan" DROP CONSTRAINT IF EXISTS plan_business_public;
ALTER TABLE public."Plan" ADD CONSTRAINT plan_business_public
  CHECK (business_user_id IS NULL OR (place_kind = 'public' AND business_location_id IS NOT NULL));
-- The business-only fields stay empty on a neighbor's plan.
ALTER TABLE public."Plan" DROP CONSTRAINT IF EXISTS plan_business_fields;
ALTER TABLE public."Plan" ADD CONSTRAINT plan_business_fields
  CHECK (business_user_id IS NOT NULL
    OR (posted_by_user_id IS NULL AND business_location_id IS NULL AND label IS NULL AND NOT guests_can_invite));
ALTER TABLE public."Plan" DROP CONSTRAINT IF EXISTS plan_label_form;
ALTER TABLE public."Plan" ADD CONSTRAINT plan_label_form
  CHECK (label IS NULL OR label ~ '^[a-z][a-z_]{0,39}$');

-- "Right away, anyone": the new rule 'open', only on a business's plan.
ALTER TABLE public."Plan" DROP CONSTRAINT IF EXISTS "Plan_auto_rules_check";
ALTER TABLE public."Plan" ADD CONSTRAINT "Plan_auto_rules_check"
  CHECK (auto_rules <@ ARRAY['verified', 'hosted_before', 'anyone_nearby', 'open']::text[]);
ALTER TABLE public."Plan" DROP CONSTRAINT IF EXISTS plan_open_needs_business;
ALTER TABLE public."Plan" ADD CONSTRAINT plan_open_needs_business
  CHECK (NOT ('open' = ANY (auto_rules)) OR business_user_id IS NOT NULL);
-- A neighbor's playdate keeps its rules (a public place, the host approves each family). A business's session
-- for kids may let families in right away; it has its own switch, plans_business_kids.
ALTER TABLE public."Plan" DROP CONSTRAINT IF EXISTS plan_playdate_rules;
ALTER TABLE public."Plan" ADD CONSTRAINT plan_playdate_rules CHECK (
  kind <> 'playdate'
  OR business_user_id IS NOT NULL
  OR (place_kind = 'public' AND join_requirement = 'verified' AND auto_rules = '{}'::text[])
);

CREATE INDEX IF NOT EXISTS plan_business_status_idx
  ON public."Plan" (business_user_id, status) WHERE business_user_id IS NOT NULL;

ALTER TABLE public."PlanRequest" ADD COLUMN IF NOT EXISTS way_in text;
ALTER TABLE public."PlanRequest" DROP CONSTRAINT IF EXISTS plan_request_way_in;
ALTER TABLE public."PlanRequest" ADD CONSTRAINT plan_request_way_in CHECK (way_in IS NULL OR way_in IN (
  'map_list', 'plans_you_like', 'today', 'new_here', 'friend', 'assistant',
  'own_invite', 'own_link', 'follower', 'come_back', 'business_page'
));

INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES
  ('plans_business', false, false, ARRAY[]::uuid[],
   'Plans with businesses: a verified business hosts a plan at its own place. A person sees a business''s plan only when both they and the business have this, and their app can draw it. Needs the plans flag. Off until the founder turns it on.'),
  ('plans_business_kids', false, false, ARRAY[]::uuid[],
   'Plans with businesses: a business''s plans for kids. Needs plans_business. Off until a lawyer has read the rules and the founder turns it on.')
ON CONFLICT (flag_name) DO NOTHING;

-- Role defaults for the two permissions added by the migration before this one. Owners get every permission in
-- code. Rows already present win, as in 20261020210000_business_role_defaults.sql.
INSERT INTO public."BusinessRolePermission" (role_base, permission, allowed)
VALUES
  ('admin', 'plans.post', true),
  ('admin', 'plans.manage', true),
  ('editor', 'plans.post', true),
  ('editor', 'plans.manage', true),
  ('staff', 'plans.post', false),
  ('staff', 'plans.manage', false),
  ('viewer', 'plans.post', false),
  ('viewer', 'plans.manage', false)
ON CONFLICT DO NOTHING;
