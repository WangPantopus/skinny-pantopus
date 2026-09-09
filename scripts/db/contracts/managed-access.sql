-- Managed Auth/storage boundary; metadata fixtures only, no external file bytes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, extensions, pg_catalog;

INSERT INTO auth.users (id, email)
VALUES ('eee00000-0000-4000-8000-000000000001', 'managed-contract@example.invalid');
DO $$ BEGIN
  IF EXISTS (SELECT FROM public."User" WHERE id = 'eee00000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'An unexpected Auth hook created an application user';
  END IF;
END $$;
SET LOCAL ROLE service_role;
INSERT INTO public."User" (id, email, username, name)
VALUES ('eee00000-0000-4000-8000-000000000001', 'managed-contract@example.invalid',
        'managed_contract', 'Managed contract');
INSERT INTO storage.buckets (id, name, public)
VALUES ('managed-contract-private', 'managed-contract-private', false);
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES ('managed-contract-private', 'private-fixture.txt', 'eee00000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id = 'managed-contract-private') <> 1 THEN
    RAISE EXCEPTION 'Service role cannot access managed storage metadata';
  END IF;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'eee00000-0000-4000-8000-000000000001', true);
DO $$
DECLARE browser_role text;
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', browser_role);
    BEGIN
      PERFORM id FROM auth.users WHERE id = 'eee00000-0000-4000-8000-000000000001';
      RAISE EXCEPTION 'Browser role can query managed Auth records directly';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    IF EXISTS (SELECT FROM storage.objects WHERE bucket_id = 'managed-contract-private') THEN
      RAISE EXCEPTION 'Browser role can read private storage metadata';
    END IF;
    BEGIN
      INSERT INTO storage.objects (bucket_id, name, owner)
      VALUES ('managed-contract-private', 'browser-write.txt', 'eee00000-0000-4000-8000-000000000001');
      RAISE EXCEPTION 'Browser role can write private storage metadata';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;
  END LOOP;
END $$;
ROLLBACK;
SELECT 'PASS: explicit application-user creation, Auth denial and private storage/service boundaries' AS result;
