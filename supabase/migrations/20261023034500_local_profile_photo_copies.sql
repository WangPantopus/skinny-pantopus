-- Backwards compatible: yes. Data only, no schema change. It writes into each LocalProfile the photo the deployed API
-- already shows for it, so nobody's photo changes; whichever of this migration and its API ships first, nothing
-- anyone sees changes.
--
-- A local profile's photo is a copy of the account's, made when the LocalProfile is created
-- (backend/utils/identityProfiles.js ensureLocalProfile) and, since 2026-10-01, moved with each account photo
-- upload. A profile made before its account had a photo kept no photo, and the API showed the account's photo in its
-- place. People can now choose the photo neighbors see (How neighbors see you, PATCH /api/local-profiles/me), "No
-- photo" included, so the API no longer puts the account's photo in place of an empty one: an empty one is a choice.
--
-- What this file writes, evaluated once against the data as it stands:
--   * Only LocalProfile rows with no photo whose account has one: avatar_url becomes the account's photo, the one the
--     API shows for them today.
--   * Every other row is left alone. Nobody had chosen "No photo" before this release.
--   * A second run changes nothing.
--
-- Read-only preview (run before applying; 0 afterwards):
--   SELECT count(*) FROM public."LocalProfile" lp JOIN public."User" u ON u.id = lp.user_id
--   WHERE lp.avatar_url IS NULL AND u.profile_picture_url IS NOT NULL;

SET LOCAL lock_timeout='5s';

UPDATE public."LocalProfile" AS lp
SET avatar_url = u.profile_picture_url,
    updated_at = now()
FROM public."User" AS u
WHERE u.id = lp.user_id
  AND lp.avatar_url IS NULL
  AND u.profile_picture_url IS NOT NULL;
