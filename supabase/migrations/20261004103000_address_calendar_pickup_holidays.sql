-- Backwards compatible: yes. Existing rules retain their kinds and gain empty
-- params; holiday rules and moved-occurrence fields are additive. Existing
-- authorized calendar RPCs project row JSON, so no new table/function is needed.
BEGIN;
SET LOCAL lock_timeout='5s';

ALTER TABLE public."AddressCalendarRule"
  ADD COLUMN params jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public."AddressCalendarRule"
  DROP CONSTRAINT "AddressCalendarRule_kind_chk",
  ADD CONSTRAINT "AddressCalendarRule_kind_chk" CHECK (kind IN (
    'garbage', 'recycling', 'yard_waste', 'bulk_pickup', 'street_sweeping',
    'property_tax', 'utility_bill', 'burn_ban', 'boil_water', 'road_closure',
    'council', 'permit_hearing', 'school', 'election_deadline', 'other',
    'pickup_holiday'
  ));

-- No holiday schedule data here. Official city rules require the founder's
-- manual provider confirmation before the separately reserved data migration.
COMMIT;
