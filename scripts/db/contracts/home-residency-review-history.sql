-- Own immutable decision history, current reviewer authority, cursor scope and
-- no invented original details. All synthetic admissions/reviews below are SQL
-- commands; this contract does not replace actual applicant/reviewer UI proof.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,extensions,pg_catalog;
CREATE FUNCTION pg_temp.rh_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('ddc27200-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;$$;
DO $$ BEGIN
 ASSERT NOT has_function_privilege('anon','public.list_home_residency_review_history(uuid,uuid,uuid,timestamptz)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.list_home_residency_review_history(uuid,uuid,uuid,timestamptz)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.get_home_residency_review_history(uuid,uuid,uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.get_home_residency_review_history(uuid,uuid,uuid)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.list_home_residency_review_history(uuid,uuid,uuid,timestamptz)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.get_home_residency_review_history(uuid,uuid,uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.home_residency_review_history_item(public."HomeResidencyReviewReceipt")','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.home_residency_review_history_item(public."HomeResidencyReviewReceipt")','EXECUTE');
 ASSERT NOT has_function_privilege('service_role','public.home_residency_review_history_item(public."HomeResidencyReviewReceipt")','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public."HomeResidencyReviewReceipt"','SELECT');
END $$;
INSERT INTO auth.users(id,email,last_sign_in_at) SELECT pg_temp.rh_id(n),'history-contract-'||n||'@example.invalid',now() FROM generate_series(1,26)n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'history_public_'||right(id::text,2),'PRIVATE_LEGAL_NAME_SENTINEL' FROM auth.users WHERE id::text LIKE 'ddc27200-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode,country)
 VALUES(pg_temp.rh_id(100),pg_temp.rh_id(1),pg_temp.rh_id(1),'History contract address','Test','WA','98607','US');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner)
 VALUES(pg_temp.rh_id(100),pg_temp.rh_id(1),'verified',true),(pg_temp.rh_id(100),pg_temp.rh_id(2),'verified',false);
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,start_at,access_end_at)
 SELECT pg_temp.rh_id(100),pg_temp.rh_id(n),'owner','owner','adult','verified',now()-interval '1 day',now()+interval '1 day' FROM generate_series(1,2)n;
CREATE FUNCTION pg_temp.rh_state() RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object(
 'home',(SELECT to_jsonb(r) FROM public."Home"r WHERE id=pg_temp.rh_id(100)),
 'claims',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."HomeResidencyClaim"r WHERE home_id=pg_temp.rh_id(100)),
 'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."HomeResidencyReviewReceipt"r WHERE home_id=pg_temp.rh_id(100)),
 'occupancies',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."HomeOccupancy"r WHERE home_id=pg_temp.rh_id(100)),
 'audit',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."HomeAuditLog"r WHERE home_id=pg_temp.rh_id(100)));$$;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
   PERFORM public.home_residency_review_history_item(NULL::public."HomeResidencyReviewReceipt");
   RAISE EXCEPTION 'Internal history helper accepted a direct service-role call';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
DO $$ DECLARE n integer;r jsonb;c uuid;a uuid;token text;BEGIN
 FOR n IN 3..25 LOOP
   r:=public.submit_home_residency(pg_temp.rh_id(100),pg_temp.rh_id(n),pg_temp.rh_id(500+n),
     '{"claimed_role":"household","address":{"line1":"History contract address","line2":"","city":"Test","state":"WA","postal_code":"98607","country":"US"}}');
   ASSERT r->>'state'='completed',r::text;c:=(r->>'claim_id')::uuid;a:=pg_temp.rh_id(CASE WHEN n=25 THEN 2 ELSE 1 END);
   token:=public.get_home_residency_review(pg_temp.rh_id(100),c,a)->'claim'->>'review_token';
   r:=public.decide_home_residency_review(pg_temp.rh_id(100),c,a,'reject',NULL,'PRIVATE_ORIGINAL_REASON_SENTINEL',pg_temp.rh_id(600+n),token);
   ASSERT r->>'ok'='true',r::text;
 END LOOP;
END $$;
DO $$ DECLARE h uuid:=pg_temp.rh_id(100);a uuid:=pg_temp.rh_id(1);b uuid:=pg_temp.rh_id(2);r jsonb;p jsonb;s jsonb;own uuid;foreign_id uuid;BEGIN
 s:=pg_temp.rh_state();r:=public.list_home_residency_review_history(h,a);ASSERT r->>'ok'='true';ASSERT jsonb_array_length(r->'items')=20;ASSERT r->'next_cursor' IS NOT NULL AND r->'next_cursor'<>'null'::jsonb;
 ASSERT (r->'items'->0->'decision'->>'actor_id')::uuid=a;ASSERT r->'items'->0->'decision'->'result'->>'status'='rejected';
 ASSERT r->'items'->0->'decision'->'result'->'role_base'='null'::jsonb;ASSERT r->'items'->0->'decision'->'result'->'occupancy_id'='null'::jsonb;
 ASSERT r->'items'->0->'current'->>'household_access'='not_checked';ASSERT r->'items'->0->'current'->'applicant'->'name'='null'::jsonb;
 ASSERT r::text NOT LIKE '%PRIVATE_%';ASSERT r::text NOT LIKE '%review_token%';ASSERT r::text NOT LIKE '%request_hash%';ASSERT r::text NOT LIKE '%review_note%';
 p:=public.list_home_residency_review_history(h,a,(r->'next_cursor'->>'id')::uuid,(r->'next_cursor'->>'created_at')::timestamptz);
 ASSERT jsonb_array_length(p->'items')=2;ASSERT p->'next_cursor'='null'::jsonb;
 ASSERT NOT EXISTS(SELECT FROM jsonb_array_elements(r->'items')x JOIN jsonb_array_elements(p->'items')y ON x->'decision'->>'id'=y->'decision'->>'id');
 own:=(r->'items'->0->'decision'->>'id')::uuid;
 SELECT id INTO foreign_id FROM public."HomeResidencyReviewReceipt" WHERE home_id=h AND actor_user_id=b;
 ASSERT public.get_home_residency_review_history(h,a,own)->'item'=r->'items'->0;
 ASSERT public.get_home_residency_review_history(h,a,foreign_id)->>'code'='RESIDENCY_HISTORY_NOT_FOUND';
 ASSERT public.get_home_residency_review_history(h,b,own)->>'code'='RESIDENCY_HISTORY_NOT_FOUND';
 ASSERT public.list_home_residency_review_history(h,a,foreign_id,clock_timestamp())->>'code'='RESIDENCY_HISTORY_CURSOR_INVALID';
 ASSERT public.list_home_residency_review_history(h,a,own,clock_timestamp())->>'code'='RESIDENCY_HISTORY_CURSOR_INVALID';
 ASSERT public.list_home_residency_review_history(h,pg_temp.rh_id(26))->>'code'='MEMBERS_MANAGE_REQUIRED';
 ASSERT pg_temp.rh_state()=s;
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,a,'members.manage',false);
 s:=pg_temp.rh_state();ASSERT public.list_home_residency_review_history(h,a)->>'code'='MEMBERS_MANAGE_REQUIRED';
 ASSERT public.get_home_residency_review_history(h,a,own)->>'code'='MEMBERS_MANAGE_REQUIRED';ASSERT pg_temp.rh_state()=s;
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=a AND permission='members.manage';
 UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()-interval '1 second' WHERE home_id=h AND user_id=b;
 s:=pg_temp.rh_state();ASSERT public.list_home_residency_review_history(h,b)->>'code'='MEMBERS_MANAGE_REQUIRED';
 ASSERT public.get_home_residency_review_history(h,b,foreign_id)->>'code'='MEMBERS_MANAGE_REQUIRED';ASSERT pg_temp.rh_state()=s;
END $$;
-- Actual resubmission updates the current reference, never the old rejected
-- receipt. A fresh real approval is followed by actual protected removal.
DO $$ DECLARE h uuid:=pg_temp.rh_id(100);a uuid:=pg_temp.rh_id(1);u uuid:=pg_temp.rh_id(3);c uuid;old_id uuid;old_row jsonb;r jsonb;token text;approved_id uuid;ctx jsonb;s jsonb;BEGIN
 SELECT id INTO c FROM public."HomeResidencyClaim" WHERE home_id=h AND user_id=u;
 SELECT id,to_jsonb(x) INTO old_id,old_row FROM public."HomeResidencyReviewReceipt"x WHERE claim_id=c;
 r:=public.submit_home_residency(h,u,pg_temp.rh_id(800),'{"claimed_role":"household","address":{"line1":"History contract address","line2":"","city":"Test","state":"WA","postal_code":"98607","country":"US"}}');
 ASSERT r->>'state'='completed';ASSERT (r->>'claim_id')::uuid=c;
 r:=public.get_home_residency_review_history(h,a,old_id);ASSERT r->'item'->'decision'->'result'->>'status'='rejected';ASSERT r->'item'->'current'->>'claim_status'='pending';
 ASSERT (SELECT to_jsonb(x)=old_row FROM public."HomeResidencyReviewReceipt"x WHERE id=old_id);
 token:=public.get_home_residency_review(h,c,a)->'claim'->>'review_token';
 r:=public.decide_home_residency_review(h,c,a,'approve','member',NULL,pg_temp.rh_id(801),token);ASSERT r->>'ok'='true';approved_id:=(r->'receipt'->>'id')::uuid;
 ctx:=public.prepare_home_member_removal(a,h,u);ASSERT ctx->>'ok'='true';
 r:=public.resolve_home_member_removal(a,pg_temp.rh_id(802),ctx-ARRAY['ok','home','target']);ASSERT r->>'state'='completed';
 s:=pg_temp.rh_state();r:=public.get_home_residency_review_history(h,a,approved_id);
 ASSERT r->'item'->'decision'->'result'->>'status'='verified';ASSERT r->'item'->'current'->>'claim_status'='verified';ASSERT r->'item'->'current'->>'household_access'='not_checked';
 ASSERT pg_temp.rh_state()=s;ASSERT (SELECT is_active=false FROM public."HomeOccupancy" WHERE home_id=h AND user_id=u);
END $$;
-- Synthetic historical tie/null-base shapes exercise cursor/projection handling
-- only; they are not described as new household admissions or backfilled data.
DO $$ DECLARE h uuid:=pg_temp.rh_id(100);a uuid:=pg_temp.rh_id(1);source public."HomeResidencyReviewReceipt"%ROWTYPE;r jsonb;p jsonb;s jsonb;BEGIN
 SELECT * INTO source FROM public."HomeResidencyReviewReceipt" WHERE home_id=h AND actor_user_id=a AND action='approve' LIMIT 1;
 INSERT INTO public."HomeResidencyReviewReceipt"(id,home_id,claim_id,actor_user_id,request_id,action,legacy_request,request_hash,review_token,result,created_at)
 SELECT pg_temp.rh_id(n),h,source.claim_id,a,pg_temp.rh_id(n+100),'approve',true,repeat('a',64),repeat('b',64),
   source.result||'{"role_base":null}'::jsonb,'2030-01-01T00:00:00.123456Z'::timestamptz FROM generate_series(900,901)n;
 s:=pg_temp.rh_state();r:=public.list_home_residency_review_history(h,a);
 ASSERT (r->'items'->0->'decision'->>'id')::uuid=pg_temp.rh_id(901);
 ASSERT (r->'items'->1->'decision'->>'id')::uuid=pg_temp.rh_id(900);
 ASSERT r->'items'->0->'decision'->'result'->'role_base'='null'::jsonb;
 p:=public.list_home_residency_review_history(h,a,pg_temp.rh_id(901),'2030-01-01T00:00:00.123456Z');
 ASSERT (p->'items'->0->'decision'->>'id')::uuid=pg_temp.rh_id(900);ASSERT pg_temp.rh_state()=s;
 -- A malformed old result is unavailable, never fabricated as missing/null.
 INSERT INTO public."HomeResidencyReviewReceipt"(id,home_id,claim_id,actor_user_id,request_id,action,legacy_request,request_hash,review_token,result)
 VALUES(pg_temp.rh_id(902),h,source.claim_id,a,pg_temp.rh_id(1002),'approve',true,repeat('a',64),repeat('b',64),source.result-'reviewed_at');
 s:=pg_temp.rh_state();ASSERT public.get_home_residency_review_history(h,a,pg_temp.rh_id(902))->>'code'='RESIDENCY_HISTORY_UNAVAILABLE';ASSERT pg_temp.rh_state()=s;
END $$;
RESET ROLE;
ROLLBACK;
