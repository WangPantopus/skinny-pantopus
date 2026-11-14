-- Backwards compatible: yes. Adds an off flag ignored by deployed apps; no table or column changes.
-- Moment elevation, part D "float by day" (plan approved by the founder on 2026-11-13): with `moment_heights` on, a
-- Moment that carries an elevation floats over the Moments map with a shadow where the real sun puts it. The map's
-- answer says `float_on` (and where the sun is) only while both flags are on for the person. Off for everyone until
-- the founder turns it on from the admin flag route, which answers 404 for a flag without a row.
BEGIN;
SET LOCAL lock_timeout = '5s';
INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES ('moment_float', false, false, ARRAY[]::uuid[],
  'Moments: Moments with an elevation float on the Moments map by day, with shadows where the sun is. Needs moment_heights. Off until the founder turns it on.')
ON CONFLICT (flag_name) DO NOTHING;

COMMIT;
