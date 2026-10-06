-- Backwards compatible: yes. Inserts reference rows only (no schema change);
-- every row is 'unverified', and the address calendar moves a pickup only for
-- an 'official' holiday row, so nothing changes for any household until a
-- row is confirmed against its provider and marked official.
--
-- Holiday pickup moves for the pilot cities, Thanksgiving 2026 through New
-- Year's Day 2027, drafted from the providers' published rules (checked
-- 2026-10-06):
--   * Vancouver and Washougal: Waste Connections of Washington collects
--     garbage, recycling and organics/yard debris. On Thanksgiving, Christmas
--     and New Year's Day (Monday to Friday) pickups on or after the holiday
--     are a day late through Saturday.
--   * Camas: the city collects garbage and moves only the holiday's own
--     pickups to the next business day (params.through = 'holiday'); its
--     2026 calendar also observes Veterans Day. Waste Connections collects
--     Camas recycling and yard debris under its one-day rule.
BEGIN;
SET LOCAL lock_timeout='5s';

INSERT INTO public."AddressCalendarRule"
  (scope_type, scope_key, kind, title, detail, rrule, dtstart, source, source_url, confidence, params)
VALUES
  ('city', 'WA:Vancouver', 'pickup_holiday', 'Thanksgiving: pickup moves one day later',
   'Waste Connections collects garbage, recycling and organics a day late for pickups on or after Thanksgiving, through Saturday.',
   'FREQ=DAILY;COUNT=1', '2026-11-26', 'City of Vancouver · Waste Connections',
   'https://www.cityofvancouver.us/services/garbage-recycling/residential/', 'unverified',
   '{"holiday":"Thanksgiving","kinds":["garbage","recycling","yard_waste"],"shift_days":1}'),
  ('city', 'WA:Vancouver', 'pickup_holiday', 'Christmas: pickup moves one day later',
   'Waste Connections collects garbage, recycling and organics a day late for pickups on or after Christmas, through Saturday.',
   'FREQ=DAILY;COUNT=1', '2026-12-25', 'City of Vancouver · Waste Connections',
   'https://www.cityofvancouver.us/services/garbage-recycling/residential/', 'unverified',
   '{"holiday":"Christmas","kinds":["garbage","recycling","yard_waste"],"shift_days":1}'),
  ('city', 'WA:Vancouver', 'pickup_holiday', 'New Year''s Day: pickup moves one day later',
   'Waste Connections collects garbage, recycling and organics a day late for pickups on or after New Year''s Day, through Saturday.',
   'FREQ=DAILY;COUNT=1', '2027-01-01', 'City of Vancouver · Waste Connections',
   'https://www.cityofvancouver.us/services/garbage-recycling/residential/', 'unverified',
   '{"holiday":"New Year''s Day","kinds":["garbage","recycling","yard_waste"],"shift_days":1}'),

  ('city', 'WA:Washougal', 'pickup_holiday', 'Thanksgiving: pickup moves one day later',
   'Waste Connections collects garbage, recycling and yard debris a day late for pickups on or after Thanksgiving, through Saturday.',
   'FREQ=DAILY;COUNT=1', '2026-11-26', 'Waste Connections of Washington',
   'https://wcnorthwest.com/faqs', 'unverified',
   '{"holiday":"Thanksgiving","kinds":["garbage","recycling","yard_waste"],"shift_days":1}'),
  ('city', 'WA:Washougal', 'pickup_holiday', 'Christmas: pickup moves one day later',
   'Waste Connections collects garbage, recycling and yard debris a day late for pickups on or after Christmas, through Saturday.',
   'FREQ=DAILY;COUNT=1', '2026-12-25', 'Waste Connections of Washington',
   'https://wcnorthwest.com/faqs', 'unverified',
   '{"holiday":"Christmas","kinds":["garbage","recycling","yard_waste"],"shift_days":1}'),
  ('city', 'WA:Washougal', 'pickup_holiday', 'New Year''s Day: pickup moves one day later',
   'Waste Connections collects garbage, recycling and yard debris a day late for pickups on or after New Year''s Day, through Saturday.',
   'FREQ=DAILY;COUNT=1', '2027-01-01', 'Waste Connections of Washington',
   'https://wcnorthwest.com/faqs', 'unverified',
   '{"holiday":"New Year''s Day","kinds":["garbage","recycling","yard_waste"],"shift_days":1}'),

  ('city', 'WA:Camas', 'pickup_holiday', 'Veterans Day: Wednesday garbage moves to Thursday',
   'The City of Camas collects Wednesday garbage on Thursday, November 12. Other days don''t change.',
   'FREQ=DAILY;COUNT=1', '2026-11-11', 'City of Camas 2026 garbage calendar',
   'https://www.cityofcamas.us/sites/default/files/fileattachments/public_works/page/8520/brochure_sanitation_schedule_2026_camas.pdf', 'unverified',
   '{"holiday":"Veterans Day","kinds":["garbage"],"shift_days":1,"through":"holiday"}'),
  ('city', 'WA:Camas', 'pickup_holiday', 'Thanksgiving: Thursday garbage moves to Friday',
   'The City of Camas collects Thursday garbage on Friday, November 27. Other days don''t change.',
   'FREQ=DAILY;COUNT=1', '2026-11-26', 'City of Camas 2026 garbage calendar',
   'https://www.cityofcamas.us/sites/default/files/fileattachments/public_works/page/8520/brochure_sanitation_schedule_2026_camas.pdf', 'unverified',
   '{"holiday":"Thanksgiving","kinds":["garbage"],"shift_days":1,"through":"holiday"}'),
  ('city', 'WA:Camas', 'pickup_holiday', 'Christmas: Friday garbage moves to Monday',
   'The City of Camas collects Friday garbage on Monday, December 28. Other days don''t change.',
   'FREQ=DAILY;COUNT=1', '2026-12-25', 'City of Camas 2026 garbage calendar',
   'https://www.cityofcamas.us/sites/default/files/fileattachments/public_works/page/8520/brochure_sanitation_schedule_2026_camas.pdf', 'unverified',
   '{"holiday":"Christmas","kinds":["garbage"],"shift_days":3,"through":"holiday"}'),
  ('city', 'WA:Camas', 'pickup_holiday', 'New Year''s Day: Friday garbage moves to Monday',
   'The City of Camas collects garbage that falls on a holiday on the next business day, Monday, January 4. Other days don''t change.',
   'FREQ=DAILY;COUNT=1', '2027-01-01', 'City of Camas',
   'https://www.cityofcamas.us/publicworks/page/garbage-collection-schedule', 'unverified',
   '{"holiday":"New Year''s Day","kinds":["garbage"],"shift_days":3,"through":"holiday"}'),
  ('city', 'WA:Camas', 'pickup_holiday', 'Thanksgiving: recycling and yard debris move one day later',
   'Waste Connections collects Camas recycling and yard debris a day late for pickups on or after Thanksgiving, through Saturday.',
   'FREQ=DAILY;COUNT=1', '2026-11-26', 'Waste Connections of Washington',
   'https://wcnorthwest.com/faqs', 'unverified',
   '{"holiday":"Thanksgiving","kinds":["recycling","yard_waste"],"shift_days":1}'),
  ('city', 'WA:Camas', 'pickup_holiday', 'Christmas: recycling and yard debris move one day later',
   'Waste Connections collects Camas recycling and yard debris a day late for pickups on or after Christmas, through Saturday.',
   'FREQ=DAILY;COUNT=1', '2026-12-25', 'Waste Connections of Washington',
   'https://wcnorthwest.com/faqs', 'unverified',
   '{"holiday":"Christmas","kinds":["recycling","yard_waste"],"shift_days":1}'),
  ('city', 'WA:Camas', 'pickup_holiday', 'New Year''s Day: recycling and yard debris move one day later',
   'Waste Connections collects Camas recycling and yard debris a day late for pickups on or after New Year''s Day, through Saturday.',
   'FREQ=DAILY;COUNT=1', '2027-01-01', 'Waste Connections of Washington',
   'https://wcnorthwest.com/faqs', 'unverified',
   '{"holiday":"New Year''s Day","kinds":["recycling","yard_waste"],"shift_days":1}')
ON CONFLICT DO NOTHING;

COMMIT;
