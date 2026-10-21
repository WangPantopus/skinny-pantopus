-- Backwards compatible: yes. Enables the two existing Plans feature flags;
-- no schema, permissions or API shapes change. Both flags remain available
-- through the admin route as operational off switches.
-- Founder direction, October 20: enable all shipped Plans kinds, including
-- playdates, while keeping pulse_redesign off. Existing playdate address
-- verification, public-place and host-approval rules still apply.
BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE public."FeatureFlag"
SET enabled_globally = true,
    updated_at = now(),
    description = CASE flag_name
      WHEN 'plans' THEN
        'Plans: the mobile Plans tab, hosting and joining, chats, reminders and web share previews. Enabled for everyone by the October 20 founder decision.'
      WHEN 'plans_playdates' THEN
        'Plans playdates: enabled by the October 20 founder decision, with existing verified-address, public-place and host-approval rules.'
    END
WHERE flag_name IN ('plans', 'plans_playdates');

COMMIT;
