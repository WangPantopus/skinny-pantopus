-- Backwards compatible: yes. Adds three PulseArea columns with constant defaults (no rewrite);
-- existing areas read as before and older code never selects them. Deploy before backend.
--
-- Places (S16, contract §2.19): a place's type, whether its conversation is only for verified homes
-- inside it (buildings, HOAs), and its sourced facts.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."PulseArea"
  ADD COLUMN place_type text CHECK (place_type IS NULL OR place_type IN ('building', 'hoa', 'school_zone', 'park',
    'trail', 'lake', 'library', 'council_district', 'other')),
  ADD COLUMN restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN facts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(facts) = 'array');
ALTER TABLE public."PulseArea" ADD CONSTRAINT "PulseArea_place_type_kind"
  CHECK ((kind = 'place') = (place_type IS NOT NULL)) NOT VALID;
ALTER TABLE public."PulseArea" VALIDATE CONSTRAINT "PulseArea_place_type_kind";

COMMIT;
