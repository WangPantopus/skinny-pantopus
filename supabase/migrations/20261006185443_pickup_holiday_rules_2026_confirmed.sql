-- Backwards compatible: yes. Data only (no schema change).
--
-- Marks the holiday pickup moves drafted in 20261006084259 'official', so
-- the address calendar moves those pickups and the evening reminder follows
-- the moved day. Confirmed on 2026-10-06 by the founder against the
-- providers' current published rules:
--   * Vancouver: the City of Vancouver and Waste Connections both say
--     Thanksgiving, Christmas and New Year's Day are the exceptions, and a
--     pickup on or after the holiday is a day late (through Saturday).
--   * Washougal: Clark County lists Waste Connections as the hauler, which
--     follows the same three holidays and the same one-day rule.
--   * Camas garbage: the City of Camas 2026 garbage calendar moves only the
--     holiday's own pickups to the next business day: Veterans Day Nov 11 to
--     Nov 12, Thanksgiving Nov 26 to Nov 27, Christmas Dec 25 to Dec 28.
--   * Camas recycling and yard debris: the city says Waste Connections
--     collects them, under its one-day rule for the three holidays (not
--     Veterans Day). Holiday rows move only the kinds they list, so on
--     Veterans Day Camas garbage moves and recycling does not.
--
-- Camas garbage on New Year's Day 2027 (Jan 1 to Jan 4) stays 'unverified':
-- it is inferred from the city's next-business-day rule until the City of
-- Camas publishes its 2027 calendar.
BEGIN;
SET LOCAL lock_timeout='5s';

UPDATE public."AddressCalendarRule"
SET confidence = 'official', updated_at = now()
WHERE kind = 'pickup_holiday'
  AND scope_type = 'city'
  AND confidence = 'unverified'
  AND (
    (scope_key IN ('WA:Vancouver', 'WA:Washougal')
      AND dtstart IN ('2026-11-26', '2026-12-25', '2027-01-01'))
    OR (scope_key = 'WA:Camas' AND params->'kinds' = '["garbage"]'::jsonb
      AND dtstart IN ('2026-11-11', '2026-11-26', '2026-12-25'))
    OR (scope_key = 'WA:Camas' AND params->'kinds' = '["recycling", "yard_waste"]'::jsonb
      AND dtstart IN ('2026-11-26', '2026-12-25', '2027-01-01'))
  );

COMMIT;
