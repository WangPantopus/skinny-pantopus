-- Admission is atomic, reuses proof and preserves the unit; no client can call it.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
INSERT INTO auth.users (id,email) VALUES
 ('eee00000-0000-4000-8000-000000000081','native-mail-1@example.invalid'),
 ('eee00000-0000-4000-8000-000000000082','native-mail-2@example.invalid'),
 ('eee00000-0000-4000-8000-000000000083','native-mail-3@example.invalid');
INSERT INTO public."User" (id,email,username,name) SELECT id,email,'native_mail_'||right(id::text,2),'Native mail contract'
 FROM auth.users WHERE id IN ('eee00000-0000-4000-8000-000000000081','eee00000-0000-4000-8000-000000000082','eee00000-0000-4000-8000-000000000083');
INSERT INTO public."Home" (id,address,address2,city,state,zipcode) VALUES
 ('eee00000-0000-4000-8000-000000000084','Synthetic native contract','Apt 4','Test','CA','00000');
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.admit_home_postcard(uuid,uuid,text)','execute')
 OR has_function_privilege('anon','public.admit_home_postcard(uuid,uuid,text)','execute')
 OR NOT has_function_privilege('service_role','public.admit_home_postcard(uuid,uuid,text)','execute') THEN
 RAISE EXCEPTION 'Incorrect native mail grants'; END IF;
 IF has_table_privilege('authenticated','public."HomePostcardCode"','select') THEN
 RAISE EXCEPTION 'Postcard hashes exposed to clients'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
 PERFORM public.admit_home_postcard('eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000081',repeat('a',64));
 RAISE EXCEPTION 'Client admitted its own code';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ DECLARE first_result jsonb; replay jsonb; second_result jsonb; result jsonb;
BEGIN
 first_result := public.admit_home_postcard('eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000081',repeat('a',64));
 IF first_result->>'reused' IS DISTINCT FROM 'false' OR first_result->'postcard'->'destination'->>'address2' IS DISTINCT FROM 'Apt 4'
 OR first_result->'postcard'->>'dispatch_status' IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'Admission lost saved destination'; END IF;
 UPDATE public."HomePostcardCode" SET dispatch_status='delivery_unknown' WHERE id=(first_result->'postcard'->>'id')::uuid;
 replay := public.admit_home_postcard('eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000081',repeat('b',64));
 IF replay->>'reused' IS DISTINCT FROM 'true' OR replay->'postcard'->>'id' IS DISTINCT FROM first_result->'postcard'->>'id'
 OR replay->'postcard'->>'code_hash' IS DISTINCT FROM repeat('a',64) THEN RAISE EXCEPTION 'Retry rotated a mailed proof'; END IF;
 second_result := public.admit_home_postcard('eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000082',repeat('b',64));
 result := public.admit_home_postcard('eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000083',repeat('c',64));
 IF result->>'error' IS DISTINCT FROM 'ADDRESS_LIMIT' THEN RAISE EXCEPTION 'Address cap bypassed'; END IF;
 UPDATE public."HomePostcardCode" SET expires_at=now()-interval '1 second' WHERE id=(first_result->'postcard'->>'id')::uuid;
 result := public.admit_home_postcard('eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000081',repeat('c',64));
 IF result->>'reused' IS DISTINCT FROM 'false' OR result->'postcard'->>'id'=first_result->'postcard'->>'id' THEN RAISE EXCEPTION 'Expired pending row blocks a new code'; END IF;
 IF NOT EXISTS (SELECT FROM public."HomePostcardCode" WHERE id=(first_result->'postcard'->>'id')::uuid AND status='expired' AND code_hash=repeat('a',64)) THEN
 RAISE EXCEPTION 'Old proof was rewritten or lost'; END IF;
 UPDATE public."HomePostcardCode" SET status='cancelled' WHERE id=(result->'postcard'->>'id')::uuid;
 result := public.admit_home_postcard('eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000081',repeat('c',64));
 UPDATE public."HomePostcardCode" SET status='cancelled' WHERE id=(result->'postcard'->>'id')::uuid;
 result := public.admit_home_postcard('eee00000-0000-4000-8000-000000000084','eee00000-0000-4000-8000-000000000081',repeat('d',64));
 IF result->>'error' IS DISTINCT FROM 'USER_LIMIT' THEN RAISE EXCEPTION 'User budget bypassed after definitive failures'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
