-- Backwards compatible: yes. Adds an off flag ignored by deployed apps; no table or column changes.
-- Moments (location stories on their own map tab; proposal and design approved by the founder on 2026-11-08) stay off
-- for everyone until the founder turns them on (internal team or beta users first) from the admin flag route, which
-- answers 404 for a flag without a row. Moments are Post rows with is_story = true; no new tables.
BEGIN;
SET LOCAL lock_timeout = '5s';
INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES ('moments', false, false, ARRAY[]::uuid[],
  'Moments: photo, video and text posts pinned on their own map for 1-48 hours, the Moments tab and its routes. Off until the founder turns it on.')
ON CONFLICT (flag_name) DO NOTHING;

COMMIT;
