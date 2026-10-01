-- Backwards compatible: yes. Data only, no schema change. It hides locality copies that the deployed API already
-- should not show (the person's Neighborhood setting is not public); whichever of this migration and its API ships
-- first, nothing anyone chose to show disappears.
--
-- A local profile's public city and state are copies, made when the LocalProfile is created
-- (backend/utils/identityProfiles.js ensureLocalProfile): show_neighborhood, public_city and public_state are set
-- only when UserPrivacySettings.show_neighborhood = 'public', and with no settings row they are hidden. Nothing
-- re-derived them afterwards. So someone who later chose "Only me" or "Followers only" for Neighborhood kept showing
-- their city on posts, comments, search and their local profile. The API now re-derives them whenever the
-- Neighborhood setting or the account's city or state changes (syncLocalProfileLocality).
--
-- What this file writes, evaluated once against the data as it stands:
--   * Only LocalProfile rows whose person's Neighborhood setting is not 'public' (or who has no settings row) and
--     that still show or hold a place: show_neighborhood becomes false, and public_city, public_state and
--     public_neighborhood become NULL. public_neighborhood is never set by the app (only by an API no client
--     calls), and every reader already hides it unless show_neighborhood is true; it is cleared for completeness.
--   * Rows whose setting is 'public' are left alone, even if their copy is stale or missing; the next save of the
--     Neighborhood setting or of the city re-derives them.
--   * It only ever hides. A second run changes nothing.
--
-- Read-only preview (run before applying; 0 afterwards):
--   SELECT count(*) FROM public."LocalProfile" lp
--   WHERE (lp.show_neighborhood OR lp.public_city IS NOT NULL OR lp.public_state IS NOT NULL
--          OR lp.public_neighborhood IS NOT NULL)
--     AND NOT EXISTS (SELECT 1 FROM public."UserPrivacySettings" s
--                     WHERE s.user_id = lp.user_id AND s.show_neighborhood = 'public');

SET LOCAL lock_timeout='5s';

UPDATE public."LocalProfile" AS lp
SET show_neighborhood = false,
    public_city = NULL,
    public_state = NULL,
    public_neighborhood = NULL,
    updated_at = now()
WHERE (lp.show_neighborhood
       OR lp.public_city IS NOT NULL
       OR lp.public_state IS NOT NULL
       OR lp.public_neighborhood IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM public."UserPrivacySettings" AS s
    WHERE s.user_id = lp.user_id
      AND s.show_neighborhood = 'public'
  );
