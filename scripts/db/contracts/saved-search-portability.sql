-- Exercise both CHECK expressions that PostgreSQL rewrites during dump/replay.
-- Run against the upgraded copy and fresh install; fixtures roll back.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, extensions, pg_catalog;

INSERT INTO auth.users (id, email)
VALUES ('ccc00000-0000-4000-8000-000000000001', 'saved-search-contract@example.invalid');
INSERT INTO public."User" (id, email, username, name)
VALUES ('ccc00000-0000-4000-8000-000000000001', 'saved-search-contract@example.invalid',
        'saved_search_contract', 'Saved search contract');

SET LOCAL ROLE service_role;
DO $$
DECLARE
  pay_value text;
  schedule_value text;
  constraint_name text;
  rejected integer := 0;
BEGIN
  -- All 20 combinations, including both nullable columns, must be accepted.
  FOREACH pay_value IN ARRAY ARRAY[NULL, 'fixed', 'hourly', 'offers']::text[] LOOP
    FOREACH schedule_value IN ARRAY ARRAY[NULL, 'asap', 'today', 'scheduled', 'flexible']::text[] LOOP
      INSERT INTO public."GigSavedSearch" (user_id, latitude, longitude, pay_type, schedule_type)
      VALUES ('ccc00000-0000-4000-8000-000000000001', 45.63, -122.67, pay_value, schedule_value);
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM public."GigSavedSearch"
      WHERE user_id = 'ccc00000-0000-4000-8000-000000000001') <> 20 THEN
    RAISE EXCEPTION 'Valid saved-search combination was not preserved';
  END IF;

  -- Check the exact rejected constraint, so another failure cannot mask a gap.
  FOREACH pay_value IN ARRAY ARRAY['', 'FIXED', 'invalid'] LOOP
    BEGIN
      INSERT INTO public."GigSavedSearch" (user_id, latitude, longitude, pay_type)
      VALUES ('ccc00000-0000-4000-8000-000000000001', 45.63, -122.67, pay_value);
      RAISE EXCEPTION 'Invalid pay type was accepted';
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS constraint_name = CONSTRAINT_NAME;
      IF constraint_name <> 'GigSavedSearch_pay_check' THEN RAISE; END IF;
      rejected := rejected + 1;
    END;
  END LOOP;
  FOREACH schedule_value IN ARRAY ARRAY['', 'ASAP', 'invalid'] LOOP
    BEGIN
      INSERT INTO public."GigSavedSearch" (user_id, latitude, longitude, schedule_type)
      VALUES ('ccc00000-0000-4000-8000-000000000001', 45.63, -122.67, schedule_value);
      RAISE EXCEPTION 'Invalid schedule type was accepted';
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS constraint_name = CONSTRAINT_NAME;
      IF constraint_name <> 'GigSavedSearch_schedule_check' THEN RAISE; END IF;
      rejected := rejected + 1;
    END;
  END LOOP;
  IF rejected <> 6 THEN RAISE EXCEPTION 'Missing saved-search rejection'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: 20 valid saved-search combinations and six named constraint rejections' AS result;
