-- Backwards compatible: yes. Widens Plan.kind to allow 'study_group' and adds a
-- check that no existing row can fail (no row has that kind yet). The deployed
-- backend never writes the new kind; apply this before the backend that does.
--
-- Nearby Plans: study groups, a fifth kind (founder, 2026-10-17). Like playdates
-- they meet in public places only. "Anyone nearby" stays limited to pickup games
-- and walks by plan_anyone_nearby_kinds, so study groups never take it.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- The inline column check from 20261013060000_nearby_plans.sql, by its generated name.
ALTER TABLE public."Plan" DROP CONSTRAINT "Plan_kind_check";
ALTER TABLE public."Plan" ADD CONSTRAINT "Plan_kind_check"
  CHECK (kind IN ('watch_party', 'playdate', 'pickup_game', 'walk_coffee', 'study_group'));

ALTER TABLE public."Plan" ADD CONSTRAINT plan_study_group_public
  CHECK (kind <> 'study_group' OR place_kind = 'public');

COMMIT;
