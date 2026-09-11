-- Verify that direct browser-role access cannot bypass the Beacon API's
-- projection, membership, block, draft and archive checks. Local fixtures only.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
INSERT INTO auth.users (id, email)
VALUES ('bbb00000-0000-4000-8000-000000000001', 'beacon-storage@example.invalid');
INSERT INTO public."User" (id, email, username, name)
VALUES ('bbb00000-0000-4000-8000-000000000001', 'beacon-storage@example.invalid',
        'beacon_storage_fixture', 'Beacon storage fixture');
INSERT INTO public."Post" (id, user_id, content, visibility, identity_context_type,
                          identity_context_id, post_as, post_metadata, target_tier_rank, archived_at)
VALUES
 ('bbb00000-0000-4000-8000-000000000010', 'bbb00000-0000-4000-8000-000000000001',
  'Synthetic public Beacon', 'public', 'persona', 'bbb00000-0000-4000-8000-000000000002', 'persona', '{"broadcast_status":"published"}', 1, NULL),
 ('bbb00000-0000-4000-8000-000000000011', 'bbb00000-0000-4000-8000-000000000001',
  'Synthetic draft Beacon', 'public', 'persona', 'bbb00000-0000-4000-8000-000000000002', 'persona', '{"broadcast_status":"draft"}', 1, NULL),
 ('bbb00000-0000-4000-8000-000000000012', 'bbb00000-0000-4000-8000-000000000001',
  'Synthetic Member Beacon', 'followers', 'persona', 'bbb00000-0000-4000-8000-000000000002', 'persona', '{"broadcast_status":"published"}', 2, NULL),
 ('bbb00000-0000-4000-8000-000000000013', 'bbb00000-0000-4000-8000-000000000001',
  'Synthetic archived Beacon', 'public', 'persona', 'bbb00000-0000-4000-8000-000000000002', 'persona', '{"broadcast_status":"published"}', 1, now()),
 ('bbb00000-0000-4000-8000-000000000014', 'bbb00000-0000-4000-8000-000000000001',
  'Legacy persona marker', 'public', 'personal', NULL, 'persona', '{}', NULL, NULL),
 ('bbb00000-0000-4000-8000-000000000020', 'bbb00000-0000-4000-8000-000000000001',
  'Ordinary public post', 'public', 'personal', NULL, 'personal', '{}', NULL, NULL);

DO $$
DECLARE role_name text; rpc_call text;
BEGIN
  -- An owner claim must not expose raw persona rows either. The authenticated
  -- API uses service_role and projects the appropriate public identity.
  PERFORM set_config('request.jwt.claim.sub', 'bbb00000-0000-4000-8000-000000000001', true);
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', role_name);
    IF EXISTS (SELECT FROM public."Post"
      WHERE user_id = 'bbb00000-0000-4000-8000-000000000001'
        AND id <> 'bbb00000-0000-4000-8000-000000000020') THEN
      RAISE EXCEPTION 'Browser role can read raw Beacon content';
    END IF;
    IF NOT EXISTS (SELECT FROM public."Post" WHERE id = 'bbb00000-0000-4000-8000-000000000020') THEN
      RAISE EXCEPTION 'Ordinary public post access changed';
    END IF;
    FOREACH rpc_call IN ARRAY ARRAY[
      'SELECT public.auto_archive_expired_posts()',
      'SELECT public.get_seeder_tapering_metrics(45.63::double precision, -122.67::double precision, 1000)',
      'SELECT public.record_post_unique_view(''bbb00000-0000-4000-8000-000000000020''::uuid, ''bbb00000-0000-4000-8000-000000000001''::uuid)'
    ] LOOP
      BEGIN
        EXECUTE rpc_call;
        RAISE EXCEPTION 'Browser role can invoke a service-only Post RPC';
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    END LOOP;
    RESET ROLE;
  END LOOP;
END $$;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public."Post" (user_id, content, visibility, identity_context_type, post_as)
    VALUES ('bbb00000-0000-4000-8000-000000000001', 'Bypass fixture', 'public', 'persona', 'persona');
    RAISE EXCEPTION 'Direct persona publication bypassed the API';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public."Post" SET identity_context_type = 'persona', post_as = 'persona'
    WHERE id = 'bbb00000-0000-4000-8000-000000000020';
    RAISE EXCEPTION 'Direct persona conversion bypassed the API';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
BEGIN
  IF (SELECT count(*) FROM public."Post" WHERE user_id = 'bbb00000-0000-4000-8000-000000000001') <> 6 THEN
    RAISE EXCEPTION 'Backend service can no longer read Beacon storage';
  END IF;
  PERFORM public.auto_archive_expired_posts();
  PERFORM public.get_seeder_tapering_metrics(45.63::double precision, -122.67::double precision, 1000);
  PERFORM public.record_post_unique_view('bbb00000-0000-4000-8000-000000000020'::uuid,
                                       'bbb00000-0000-4000-8000-000000000001'::uuid);
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: raw Beacon reads/writes denied to browser roles, ordinary public reads preserved, backend storage access preserved' AS result;
