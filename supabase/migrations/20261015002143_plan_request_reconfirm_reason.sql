-- Backwards compatible: yes. Adds one nullable column to PlanRequest and a CHECK that null passes; every
-- existing row stays valid and keeps its meaning (null: the apps word "Still coming?" as before).
-- Deploy migration before backend (the backend selects the column).
--
-- Nearby Plans: what the host's change asked "Still coming?" about, so the guest's in-app card says what the
-- push said ("It's at a new place now. Still coming?" for a new place) instead of always saying the time moved.
--   * PlanRequest.reconfirm_reason: 'time', 'place' or 'both', set with reconfirm_requested_at when the host
--     moves the time by more than 30 minutes or changes the place; cleared when the person asks again.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."PlanRequest" ADD COLUMN IF NOT EXISTS reconfirm_reason text;

ALTER TABLE public."PlanRequest" DROP CONSTRAINT IF EXISTS "PlanRequest_reconfirm_reason_check";
ALTER TABLE public."PlanRequest" ADD CONSTRAINT "PlanRequest_reconfirm_reason_check"
  CHECK (reconfirm_reason IS NULL OR reconfirm_reason IN ('time', 'place', 'both'));

COMMENT ON COLUMN public."PlanRequest".reconfirm_reason IS
  'What the host''s last change asked "Still coming?" about: time, place or both. Null until a change asks.';
