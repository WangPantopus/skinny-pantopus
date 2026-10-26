-- Backwards compatible: yes. Adds an off flag ignored by deployed apps.
-- Nationwide sports choices and provider schedules stay off until the founder enables them.
BEGIN;
SET LOCAL lock_timeout = '5s';
INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES ('plans_sports', false, false, ARRAY[]::uuid[],
  'Opt-in Plans sports teams and provider schedules. Off until the founder verifies coverage and enables testers.')
ON CONFLICT (flag_name) DO NOTHING;

COMMIT;
