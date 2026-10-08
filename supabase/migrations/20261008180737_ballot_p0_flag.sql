-- Backwards compatible: yes. Inserts one feature-flag row with every switch
-- off; no schema, function or existing row changes. Deployed apps ignore it,
-- and the backend treats an absent or disabled ballot_p0 flag identically.
--
-- Why a migration: the admin flag route only updates an existing row
-- (backend/routes/featureFlags.js), and ballot_p0 has no environment
-- fallback, so the row must exist before an admin can enable Ballot P0
-- for internal users (docs/ballot-implementation-plan-2026-09-24.md §5.4).
SET LOCAL lock_timeout = '5s';

INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES (
  'ballot_p0',
  false,
  false,
  ARRAY[]::uuid[],
  'Ballot P0: the Place "Your ballot" card, the /start teaser and the Today ballot card. Off until the founder approves release (docs/ballot-implementation-plan-2026-09-24.md §11).'
)
ON CONFLICT (flag_name) DO NOTHING;
