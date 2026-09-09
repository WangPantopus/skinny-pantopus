-- 169_place_rls_hardening.sql
-- Audit remediation (PR #353 review, CONFIRMED high): the Place-wave
-- tables were created in the exposed `public` schema with neither RLS
-- nor anon/authenticated REVOKEs. On Supabase that means any holder of
-- the anon key — and every logged-in user, since sessions carry a
-- PostgREST-accepted access token — could read them through the Data
-- API directly, bypassing every route gate:
--   FridgeCard          the household's medical/allergy content, the
--                       exact address, and the live bearer card_code
--   ResidencyClaim      claim codes + statements (+ address scope)
--   ResidencyClaimAccess the issuer-only audit trail
--   HomeRecordWatch     loan month + alert bookkeeping
--   HomeSystem          the household's systems record
--
-- All legitimate access is through the backend's service_role client,
-- which bypasses RLS — so enabling RLS with no policies plus REVOKE
-- closes the Data-API path with zero behavior change for the app
-- (the 086_push_tokens / Calendarly-migration precedent).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'FridgeCard',
    'ResidencyClaim',
    'ResidencyClaimAccess',
    'HomeRecordWatch',
    'HomeSystem'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'public', t);
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon', 'public', t);
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM authenticated', 'public', t);
      EXECUTE format('GRANT ALL ON TABLE %I.%I TO service_role', 'public', t);
    END IF;
  END LOOP;
END $$;
