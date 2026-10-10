-- Backwards compatible: yes. Updates the one existing ballot_p0 feature-flag
-- row to enabled_globally = true; no schema, function or other row changes.
-- Older apps ignore Ballot (they never send ballot=1), and the flag can be
-- switched off again from the admin route (backend/routes/featureFlags.js).
--
-- Why: the founder decided on 2026-10-10 that Ballot ships as normal app
-- behavior on web, iOS and Android, ahead of the November 3 general election
-- (docs/ballot-implementation-plan-2026-09-24.md §11). Flags graduate to
-- normal behavior through a migration (backend/services/featureFlagService.js).
SET LOCAL lock_timeout = '5s';

UPDATE public."FeatureFlag"
SET enabled_globally = true,
    description = 'Ballot P0: the Place "Your ballot" card, the governments view, the /start teaser and the Today ballot card. On for everyone since 2026-10-10 (docs/ballot-implementation-plan-2026-09-24.md §11).'
WHERE flag_name = 'ballot_p0';
