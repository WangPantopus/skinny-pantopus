-- Backwards compatible: yes. Data only (no schema change).
--
-- Fills the county radon zones the September import missed and names
-- Connecticut's planning regions in the HUD rent rows.
--
-- Radon source, fetched 2026-10-15: EPA Map of Radon Zones spreadsheet
-- (EPA 402/A-16/001), https://www.epa.gov/system/files/documents/2024-05/radon_zones-spreadsheet.xls,
-- linked from https://www.epa.gov/radon/epa-map-radon-zones.
-- County changes, fetched 2026-10-15: U.S. Census Bureau, "Changes to
-- Counties or County Equivalent Entities", 2000s and 2010s pages under
-- https://www.census.gov/programs-surveys/geography/technical-documentation/county-changes.html.
--
-- 1. Counties that share their name with an independent city. The import
--    joined EPA's rows to FIPS codes by state and name, and each of these
--    counties lost its row to the city: Baltimore County MD, St. Louis
--    County MO, and Fairfax, Franklin, Richmond and Roanoke Counties VA.
--    Zones are EPA's county rows.
-- 2. Bedford County VA (51019) carried the zone of the former Bedford city
--    (1). EPA's Bedford County row is zone 2; the city became a town in the
--    county on July 1, 2013.
-- 3. Areas renamed or redrawn after EPA's 1993 map take the zone EPA gave
--    the area they came from:
--      Oglala Lakota County SD (46102), Shannon County until 2015: zone 2.
--      Alaska, every source area zone 3: Kusilvak (Wade Hampton until
--      2015); Chugach and Copper River (split from Valdez-Cordova in 2019);
--      Hoonah-Angoon and Skagway (from Skagway-Hoonah-Angoon, 2007);
--      Wrangell and Petersburg (from Wrangell-Petersburg, 2008, and
--      Hoonah-Angoon, 2013); Prince of Wales-Hyder (from Prince of
--      Wales-Outer Ketchikan, 2008).
--    Connecticut's planning regions get no row: each spans old counties in
--    different zones, so the app matches a Connecticut point through its
--    town to the old county (backend/data/connecticutTowns.js). Puerto Rico
--    is not on EPA's map and stays without a zone.
-- 4. HudFmr: the FY2026 import named each Connecticut planning region after
--    its first town (09110 "Avon town"), so a Hartford home read "fair
--    market rent ... in Avon town". Names from the Census crosswalk,
--    https://www2.census.gov/geo/docs/reference/ct_change/ct_cou_to_cousub_crosswalk.txt.

SET LOCAL lock_timeout = '5s';

INSERT INTO "public"."CountyRadonZone" ("county_fips", "zone", "county_label") VALUES
  ('24005', 1, 'Baltimore County'),
  ('29189', 2, 'St. Louis County'),
  ('51059', 1, 'Fairfax County'),
  ('51067', 2, 'Franklin County'),
  ('51159', 3, 'Richmond County'),
  ('51161', 1, 'Roanoke County'),
  ('46102', 2, 'Oglala Lakota County'),
  ('02063', 3, 'Chugach Census Area'),
  ('02066', 3, 'Copper River Census Area'),
  ('02105', 3, 'Hoonah-Angoon Census Area'),
  ('02158', 3, 'Kusilvak Census Area'),
  ('02195', 3, 'Petersburg Borough'),
  ('02198', 3, 'Prince of Wales-Hyder Census Area'),
  ('02230', 3, 'Skagway Municipality'),
  ('02275', 3, 'Wrangell City and Borough')
ON CONFLICT ("county_fips") DO NOTHING;

UPDATE "public"."CountyRadonZone" SET "zone" = 2
WHERE "county_fips" = '51019' AND "zone" = 1;

UPDATE "public"."HudFmr" AS h SET "county_name" = v."name"
FROM (VALUES
  ('09110', 'Capitol Planning Region'),
  ('09120', 'Greater Bridgeport Planning Region'),
  ('09130', 'Lower Connecticut River Valley Planning Region'),
  ('09140', 'Naugatuck Valley Planning Region'),
  ('09150', 'Northeastern Connecticut Planning Region'),
  ('09160', 'Northwest Hills Planning Region'),
  ('09170', 'South Central Connecticut Planning Region'),
  ('09180', 'Southeastern Connecticut Planning Region'),
  ('09190', 'Western Connecticut Planning Region')
) AS v("fips", "name")
WHERE h."county_fips" = v."fips" AND h."fiscal_year" = 2026;
