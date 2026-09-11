BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
INSERT INTO auth.users (id,email) VALUES
 ('eee00000-0000-4000-8000-000000000081','replace-owner@example.invalid'),
 ('eee00000-0000-4000-8000-000000000082','replace-manager@example.invalid');
INSERT INTO public."User" (id,email,username,name) VALUES
 ('eee00000-0000-4000-8000-000000000081','replace-owner@example.invalid','replace_owner_contract','Replace owner'),
 ('eee00000-0000-4000-8000-000000000082','replace-manager@example.invalid','replace_manager_contract','Replace manager');
INSERT INTO public."Home" (id,owner_id,address,city,state,zipcode) VALUES
 ('eee00000-0000-4000-8000-000000000080','eee00000-0000-4000-8000-000000000081','Synthetic replacement','Test','CA','00000');
SET LOCAL ROLE service_role;
INSERT INTO public."File" (id,user_id,home_id,filename,original_filename,file_path,file_url,file_size,
 mime_type,file_extension,file_type,visibility,metadata) VALUES
 ('eee00000-0000-4000-8000-000000000083','eee00000-0000-4000-8000-000000000081','eee00000-0000-4000-8000-000000000080',
  'original.txt','original.txt','eee00000-0000-4000-8000-000000000080/eee00000-0000-4000-8000-000000000083/'||repeat('c',64),
  '/original/content',6,'text/plain','.txt','home_document','private',
  jsonb_build_object('storage_contract','home_document_v1','storage_bucket','replace-contract','upload_fingerprint',repeat('a',64),'upload_sha256',repeat('c',64)));
INSERT INTO public."HomeDocument" (id,file_id,home_id,created_by,title,doc_type,visibility,details) VALUES
 ('eee00000-0000-4000-8000-000000000083','eee00000-0000-4000-8000-000000000083',
  'eee00000-0000-4000-8000-000000000080','eee00000-0000-4000-8000-000000000081','Keep this title','receipt','members',
  jsonb_build_object('storage_contract','home_document_v1','upload_fingerprint',repeat('a',64),'tags','keep me'));
RESET ROLE;
CREATE FUNCTION pg_temp.reserve_replace(p_id uuid) RETURNS void LANGUAGE sql AS $f$
 INSERT INTO public."File" (id,user_id,home_id,filename,original_filename,file_path,file_url,file_size,
  mime_type,file_extension,file_type,visibility,processing_status,metadata) VALUES
  (p_id,'eee00000-0000-4000-8000-000000000082','eee00000-0000-4000-8000-000000000080','new.pdf','new.pdf',
   'eee00000-0000-4000-8000-000000000080/'||p_id::text||'/'||repeat('d',64),'/original/content',10,'application/pdf','.pdf',
   'home_document','private','uploading',jsonb_build_object('storage_contract','home_document_v1',
    'storage_bucket','replace-contract','storage_key_id',p_id::text,'upload_fingerprint',repeat('b',64),'upload_sha256',repeat('d',64),
    'replacement_pending',true,'replacement_target','eee00000-0000-4000-8000-000000000083',
    'replacement_expected_version','eee00000-0000-4000-8000-000000000083'));
$f$;
SET LOCAL ROLE service_role;
SELECT pg_temp.reserve_replace('eee00000-0000-4000-8000-000000000084');
DO $$
DECLARE r jsonb; cleanup jsonb;
BEGIN
 r := public.replace_home_document_file('eee00000-0000-4000-8000-000000000080','eee00000-0000-4000-8000-000000000083',
  'eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000081',
  'eee00000-0000-4000-8000-000000000083',repeat('a',64),'members',repeat('b',64));
 IF r->>'code' IS DISTINCT FROM 'DOCUMENT_CHANGED' THEN RAISE EXCEPTION 'Wrong actor applied replacement'; END IF;
 r := public.replace_home_document_file('eee00000-0000-4000-8000-000000000080','eee00000-0000-4000-8000-000000000083',
  'eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000082',
  'eee00000-0000-4000-8000-000000000083',repeat('a',64),'sensitive',repeat('b',64));
 IF r->>'code' IS DISTINCT FROM 'DOCUMENT_CHANGED' THEN RAISE EXCEPTION 'Visibility race applied replacement'; END IF;
 FOR iteration IN 1..2 LOOP
  r := public.replace_home_document_file('eee00000-0000-4000-8000-000000000080','eee00000-0000-4000-8000-000000000083',
   'eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000082',
   'eee00000-0000-4000-8000-000000000083',repeat('a',64),'members',repeat('b',64));
  IF r->'document'->>'id' IS DISTINCT FROM 'eee00000-0000-4000-8000-000000000083'
    OR r->'document'->>'file_id' IS DISTINCT FROM 'eee00000-0000-4000-8000-000000000083'
    OR r->'document'->'details'->>'upload_version' IS DISTINCT FROM 'eee00000-0000-4000-8000-000000000084'
    OR r->'document'->>'title' IS DISTINCT FROM 'Keep this title'
    OR r->'document'->'details'->>'tags' IS DISTINCT FROM 'keep me'
    OR r->'document'->>'doc_type' IS DISTINCT FROM 'receipt'
    OR r->'document'->>'visibility' IS DISTINCT FROM 'members'
    OR (r->>'reused')::boolean IS DISTINCT FROM (iteration=2) THEN
    RAISE EXCEPTION 'Replacement changed metadata, identity or retry result';
  END IF;
 END LOOP;
 IF (SELECT storage_used FROM public."FileQuota" WHERE user_id='eee00000-0000-4000-8000-000000000081') <> 0
  OR (SELECT storage_used FROM public."FileQuota" WHERE user_id='eee00000-0000-4000-8000-000000000082') <> 10
  OR (SELECT file_count FROM public."FileQuota" WHERE user_id='eee00000-0000-4000-8000-000000000082') <> 1 THEN
  RAISE EXCEPTION 'Replacement quota was not transferred once';
 END IF;
 IF public.reject_home_document_replacement('eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000082') THEN
  RAISE EXCEPTION 'Applied replacement was rejected';
 END IF;
 PERFORM pg_temp.reserve_replace('eee00000-0000-4000-8000-000000000085');
 r := public.replace_home_document_file('eee00000-0000-4000-8000-000000000080','eee00000-0000-4000-8000-000000000083',
  'eee00000-0000-4000-8000-000000000085','eee00000-0000-4000-8000-000000000082',
  'eee00000-0000-4000-8000-000000000083',repeat('a',64),'members',repeat('b',64));
 IF r->>'code' IS DISTINCT FROM 'DOCUMENT_CHANGED' THEN RAISE EXCEPTION 'Stale version overwrote current file'; END IF;
 PERFORM public.reject_home_document_replacement('eee00000-0000-4000-8000-000000000085','eee00000-0000-4000-8000-000000000082');
 PERFORM public.reject_home_document_replacement('eee00000-0000-4000-8000-000000000085','eee00000-0000-4000-8000-000000000082');
 IF (SELECT storage_used FROM public."FileQuota" WHERE user_id='eee00000-0000-4000-8000-000000000082') <> 10 THEN
  RAISE EXCEPTION 'Rejected replacement quota was not released once';
 END IF;
 UPDATE public."File" SET updated_at=now()-interval '2 days' WHERE id='eee00000-0000-4000-8000-000000000084';
 cleanup := public.claim_home_document_cleanup('eee00000-0000-4000-8000-000000000084','replace-contract');
 IF cleanup->'metadata'->>'storage_key_id' IS DISTINCT FROM 'eee00000-0000-4000-8000-000000000083'
  OR cleanup->>'file_path' = (SELECT file_path FROM public."File" WHERE id='eee00000-0000-4000-8000-000000000083') THEN
  RAISE EXCEPTION 'Old cleanup cannot distinguish the previous byte version';
 END IF;
 r := public.delete_home_document_file('eee00000-0000-4000-8000-000000000080','eee00000-0000-4000-8000-000000000083',
  'eee00000-0000-4000-8000-000000000082',repeat('b',64),'members');
 IF r->'file'->'metadata'->>'storage_key_id' IS DISTINCT FROM 'eee00000-0000-4000-8000-000000000084'
  OR (SELECT storage_used FROM public."FileQuota" WHERE user_id='eee00000-0000-4000-8000-000000000082') <> 0 THEN
  RAISE EXCEPTION 'Deletion lost the current byte version or quota';
 END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('replace_home_document_file','reject_home_document_replacement')
  AND (has_function_privilege('anon',p.oid,'execute') OR has_function_privilege('authenticated',p.oid,'execute'))) THEN
  RAISE EXCEPTION 'Untrusted client can replace private documents';
 END IF;
END $$;
ROLLBACK;
SELECT 'PASS: stable replacement, preserved metadata, actor/version isolation, quota transfer, retry and cleanup';
