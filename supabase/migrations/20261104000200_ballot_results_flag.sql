-- Backwards compatible: yes. Inserts one feature-flag row, switched on; no
-- schema, function or existing row changes. Deployed apps ignore it: the
-- backend reads it to put Washington's live count on the Ballot card while
-- ballots are counted, as server-written text every app already shows.
--
-- Why on at release: on 2026-11-03 the founder approved Step 1 of
-- docs/product/ballot-live-results-plan-2026-11-03.md for that evening's
-- count. Switching enabled_globally off from the admin route
-- (backend/routes/featureFlags.js) brings back the card's earlier counting
-- text within a minute (the flag cache's TTL).
SET LOCAL lock_timeout = '5s';

INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES (
  'ballot_results',
  true,
  false,
  ARRAY[]::uuid[],
  'Ballot live results: while ballots are counted, the "Your ballot" card shows the official count for the address''s races from the state''s results site (Washington). On since 2026-11-03 (docs/product/ballot-live-results-plan-2026-11-03.md).'
)
ON CONFLICT (flag_name) DO NOTHING;
