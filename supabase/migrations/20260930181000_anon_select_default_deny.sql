-- Backwards compatible: yes. Revokes every remaining privilege on public tables,
-- views and sequences from anon, including SELECT, and makes tables and sequences
-- created later start without them. authenticated and service_role keep their
-- privileges; row-level-security policies, functions and rows are unchanged.
--
-- No app reads the database with the anon key. Web, iOS and Android call the
-- API, and none ships a Supabase client or the key. The backend's anon client
-- mostly makes GoTrue calls. Three gigs.js routes still read through it:
-- /nearby, /user/me and /assignments/me (launch cut #4, or unused). Row-level
-- security already hides every row from them, so they return nothing today;
-- after this they report the refusal as an error instead (Stream 2 agreed).
-- offers.js also uses it, but the lowercase gigs and offers tables it names
-- don't exist, so it fails before and after this. debug.js answers 404 in
-- production.
--
-- Until now, anyone holding the anon key could still read, straight through
-- PostgREST, whatever the anon-admitting policies expose: published business
-- pages, HomePublicData, SeededBusiness, SubscriptionPlan and the business role
-- reference tables. 20260930174000 (#992) already removed anon's writes.
--
-- PostGIS owns spatial_ref_sys, geography_columns and geometry_columns, so the
-- REVOKE only warns for those; they hold spatial reference metadata.
SET LOCAL lock_timeout='5s';

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
