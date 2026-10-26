-- Backwards compatible: yes. Existing rows default to an empty opt-in preference.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."UserFeedPreference"
  ADD COLUMN IF NOT EXISTS sports jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public."UserFeedPreference"
  ADD CONSTRAINT user_feed_preference_sports_object CHECK (jsonb_typeof(sports) = 'object');
COMMENT ON COLUMN public."UserFeedPreference".sports IS
  'Opt-in Plans sports: watch on/off, followed teams and leagues, and hidden team ids. Empty means unset.';

COMMIT;
