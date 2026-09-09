-- Service-only byte deletion, quota idempotency and generic File bypass denial.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
INSERT INTO auth.users (id, email)
VALUES ('eee00000-0000-4000-8000-000000000031', 'document-delete@example.invalid');
INSERT INTO public."User" (id, email, username, name)
VALUES ('eee00000-0000-4000-8000-000000000031', 'document-delete@example.invalid',
        'document_delete_contract', 'Document delete contract');
INSERT INTO public."Home" (id, owner_id, address, city, state, zipcode)
VALUES ('eee00000-0000-4000-8000-000000000032', 'eee00000-0000-4000-8000-000000000031',
        'Synthetic storage contract', 'Test', 'CA', '00000');
SET LOCAL ROLE service_role;
INSERT INTO public."File" (id, user_id, home_id, filename, original_filename,
  file_path, file_url, file_size, mime_type, file_extension, file_type, visibility, metadata)
VALUES ('eee00000-0000-4000-8000-000000000033', 'eee00000-0000-4000-8000-000000000031',
  'eee00000-0000-4000-8000-000000000032', 'fixture.txt', 'fixture.txt', 'private-key',
  '/api/homes/fixture/content', 19, 'text/plain', '.txt', 'home_document', 'private',
  jsonb_build_object('storage_contract', 'home_document_v1', 'upload_fingerprint', repeat('a', 64)));
INSERT INTO public."HomeDocument" (id, file_id, home_id, created_by, title, doc_type, visibility, details)
VALUES ('eee00000-0000-4000-8000-000000000033', 'eee00000-0000-4000-8000-000000000033',
  'eee00000-0000-4000-8000-000000000032', 'eee00000-0000-4000-8000-000000000031',
  'Private contract document', 'receipt', 'members',
  jsonb_build_object('storage_contract', 'home_document_v1', 'upload_fingerprint', repeat('a', 64)));
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.delete_home_document_file(uuid,uuid,uuid,text,text)', 'execute')
    OR has_function_privilege('authenticated', 'public.delete_home_document_file(uuid,uuid,uuid,text,text)', 'execute') THEN
    RAISE EXCEPTION 'Untrusted roles can call document deletion';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'eee00000-0000-4000-8000-000000000031', true);
DO $$
DECLARE affected integer;
BEGIN
  IF EXISTS (SELECT FROM public."File" WHERE id = 'eee00000-0000-4000-8000-000000000033') THEN
    RAISE EXCEPTION 'Generic File reads expose private document metadata';
  END IF;
  BEGIN
    UPDATE public."File" SET is_deleted = true WHERE id = 'eee00000-0000-4000-8000-000000000033';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Generic File update bypassed the Home contract'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public."File" WHERE id = 'eee00000-0000-4000-8000-000000000033';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Generic File delete bypassed the Home contract'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    IF (public.soft_delete_file('eee00000-0000-4000-8000-000000000033',
      'eee00000-0000-4000-8000-000000000031')->>'success')::boolean THEN
      RAISE EXCEPTION 'Generic delete RPC bypassed the Home contract';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public."File" (user_id, filename, original_filename, file_path, file_url,
      file_size, mime_type, file_extension, file_type, metadata)
    VALUES ('eee00000-0000-4000-8000-000000000031', 'forged.txt', 'forged.txt', 'forged',
      'forged', 1, 'text/plain', '.txt', 'home_document', '{"storage_contract":"home_document_v1"}');
    RAISE EXCEPTION 'Client inserted a trusted private storage record';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
DECLARE r jsonb;
BEGIN
  r := public.delete_home_document_file('eee00000-0000-4000-8000-000000000032',
    'eee00000-0000-4000-8000-000000000033', 'eee00000-0000-4000-8000-000000000031', repeat('a', 64), 'sensitive');
  IF r->>'code' IS DISTINCT FROM 'DOCUMENT_CHANGED' THEN RAISE EXCEPTION 'Visibility race was not rejected'; END IF;
  r := public.delete_home_document_file('eee00000-0000-4000-8000-000000000032',
    'eee00000-0000-4000-8000-000000000033', 'eee00000-0000-4000-8000-000000000031', repeat('b', 64), 'members');
  IF r->>'code' IS DISTINCT FROM 'DOCUMENT_CHANGED' THEN RAISE EXCEPTION 'Version race was not rejected'; END IF;
  FOR iteration IN 1..3 LOOP
    r := public.delete_home_document_file('eee00000-0000-4000-8000-000000000032',
      'eee00000-0000-4000-8000-000000000033', 'eee00000-0000-4000-8000-000000000031', repeat('a', 64), 'members');
    IF r->'file'->>'is_deleted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Deletion failed'; END IF;
  END LOOP;
  IF EXISTS (SELECT FROM public."HomeDocument" WHERE id='eee00000-0000-4000-8000-000000000033') THEN
    RAISE EXCEPTION 'Document survived deletion';
  END IF;
  IF (SELECT storage_used FROM public."FileQuota" WHERE user_id='eee00000-0000-4000-8000-000000000031') <> 0
    OR (SELECT file_count FROM public."FileQuota" WHERE user_id='eee00000-0000-4000-8000-000000000031') <> 0 THEN
    RAISE EXCEPTION 'Document quota was not released once';
  END IF;
  IF NOT EXISTS (SELECT FROM public."File" WHERE id='eee00000-0000-4000-8000-000000000033'
    AND is_deleted AND metadata->>'deleted_document_visibility' = 'members'
    AND metadata->>'storage_cleanup_pending' = 'true') THEN
    RAISE EXCEPTION 'Deletion lost its retry/cleanup tombstone';
  END IF;
  UPDATE public."File" SET deleted_at = now() - interval '60 days'
    WHERE id='eee00000-0000-4000-8000-000000000033';
  PERFORM public.cleanup_old_deleted_files(30);
  IF NOT EXISTS (SELECT FROM public."File" WHERE id='eee00000-0000-4000-8000-000000000033') THEN
    RAISE EXCEPTION 'Generic retention removed the upload UUID tombstone';
  END IF;
  BEGIN
    INSERT INTO public."HomeDocument" (id, file_id, home_id, created_by, title, doc_type, visibility, details)
    VALUES ('eee00000-0000-4000-8000-000000000033', 'eee00000-0000-4000-8000-000000000033',
      'eee00000-0000-4000-8000-000000000032', 'eee00000-0000-4000-8000-000000000031',
      'Late retry', 'receipt', 'members',
      jsonb_build_object('storage_contract', 'home_document_v1', 'upload_fingerprint', repeat('a', 64)));
    RAISE EXCEPTION 'In-flight upload recreated a deleted document';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
