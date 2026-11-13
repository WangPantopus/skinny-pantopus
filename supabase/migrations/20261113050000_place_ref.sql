-- Backwards compatible: yes. Adds nullable columns that deployed apps and the current server ignore; nothing
-- existing is changed, and no row is rewritten.
--
-- One key for a place (the business graph's shared pieces, approved by the founder on 2026-11-11), and Plans
-- step 1, "a plan remembers its venue" (the founder's go on 2026-11-12):
--
--   Plan.place_ref              the place picker's own id for the public place a plan is at, such as
--                               osm:node/123. Null at a home, and for a place typed or dropped on the map by hand.
--   BusinessLocation.place_ref  the place on the map this business location is. Set only by the owner's own
--                               pick or confirmation, never guessed, so it stays null until a screen asks them.
--
-- Deploy this migration before the backend that reads Plan.place_ref.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."Plan" ADD COLUMN IF NOT EXISTS place_ref text;
ALTER TABLE public."Plan" DROP CONSTRAINT IF EXISTS plan_place_ref_form;
ALTER TABLE public."Plan" ADD CONSTRAINT plan_place_ref_form
  CHECK (place_ref IS NULL OR place_ref ~ '^osm:(node|way|relation)/[0-9]{1,19}$');
-- A home's place is private: a plan at a home never carries a key that names a place.
ALTER TABLE public."Plan" DROP CONSTRAINT IF EXISTS plan_place_ref_public;
ALTER TABLE public."Plan" ADD CONSTRAINT plan_place_ref_public
  CHECK (place_ref IS NULL OR place_kind = 'public');
CREATE INDEX IF NOT EXISTS plan_place_ref_idx ON public."Plan" (place_ref) WHERE place_ref IS NOT NULL;

ALTER TABLE public."BusinessLocation"
  ADD COLUMN IF NOT EXISTS place_ref text,
  ADD COLUMN IF NOT EXISTS place_ref_source text,
  ADD COLUMN IF NOT EXISTS place_ref_at timestamptz;
ALTER TABLE public."BusinessLocation" DROP CONSTRAINT IF EXISTS businesslocation_place_ref_form;
ALTER TABLE public."BusinessLocation" ADD CONSTRAINT businesslocation_place_ref_form
  CHECK (place_ref IS NULL OR place_ref ~ '^osm:(node|way|relation)/[0-9]{1,19}$');
ALTER TABLE public."BusinessLocation" DROP CONSTRAINT IF EXISTS businesslocation_place_ref_source;
ALTER TABLE public."BusinessLocation" ADD CONSTRAINT businesslocation_place_ref_source
  CHECK (place_ref_source IS NULL OR place_ref_source IN ('owner_pick', 'owner_confirmed'));
-- A key always says how it was learned.
ALTER TABLE public."BusinessLocation" DROP CONSTRAINT IF EXISTS businesslocation_place_ref_known;
ALTER TABLE public."BusinessLocation" ADD CONSTRAINT businesslocation_place_ref_known
  CHECK (place_ref IS NULL OR (place_ref_source IS NOT NULL AND place_ref_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS businesslocation_place_ref_idx
  ON public."BusinessLocation" (place_ref) WHERE place_ref IS NOT NULL;

COMMIT;
