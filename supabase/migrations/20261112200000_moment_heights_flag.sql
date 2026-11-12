-- Backwards compatible: yes. Adds an off flag ignored by deployed apps; no table or column changes.
-- "Show height" on Moments (plan approved by the founder on 2026-11-12): a Moment may say how high above sea level
-- it was posted, kept in the Moment's own details (Post.post_metadata.moment.altitude_ft, feet rounded to 10) and
-- never for a Moment at home, shown as an area or with no location. Off for everyone until the founder turns it on
-- from the admin flag route, which answers 404 for a flag without a row. While it is off the server keeps no
-- height and returns none.
BEGIN;
SET LOCAL lock_timeout = '5s';
INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES ('moment_heights', false, false, ARRAY[]::uuid[],
  'Moments: "Show height" when posting, and heights on the Moments map and in the viewer. Needs the moments flag. Off until the founder turns it on.')
ON CONFLICT (flag_name) DO NOTHING;

COMMIT;
