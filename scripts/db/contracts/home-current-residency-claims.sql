-- Current authorized pending queue, safe public profile and null-date legacy
-- compatibility. Synthetic SQL commands support, but do not replace, real UI.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,extensions,pg_catalog;
CREATE FUNCTION pg_temp.rq_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('ddc27300-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid; $$;
CREATE FUNCTION pg_temp.rq_state(h uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object(
   'home',(SELECT to_jsonb(x) FROM public."Home" x WHERE id=h),
   'claims',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public."HomeResidencyClaim" x WHERE home_id=h),
   'members',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public."HomeOccupancy" x WHERE home_id=h),
   'owners',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public."HomeOwner" x WHERE home_id=h),
   'overrides',(SELECT jsonb_agg(to_jsonb(x) ORDER BY user_id,permission) FROM public."HomePermissionOverride" x WHERE home_id=h),
   'receipts',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public."HomeResidencyReviewReceipt" x WHERE home_id=h),
   'submissions',(SELECT jsonb_agg(to_jsonb(x) ORDER BY actor_user_id,request_id) FROM public."HomeResidencySubmissionCommand" x WHERE home_id=h),
   'audit',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public."HomeAuditLog" x WHERE home_id=h),
   'letters',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public."ResidencyLetter" x WHERE home_id=h),
   'codes',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public."HomePostcardCode" x WHERE home_id=h),
   'users',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public."User" x WHERE id::text LIKE 'ddc27300-%'),
   'defaults',(SELECT jsonb_agg(to_jsonb(x) ORDER BY role_base,permission) FROM public."HomeRolePermission" x)); $$;
DO $$ BEGIN
 ASSERT NOT has_function_privilege('anon','public.list_home_current_residency_claims(uuid,uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.list_home_current_residency_claims(uuid,uuid)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.list_home_current_residency_claims(uuid,uuid)','EXECUTE');
 ASSERT (SELECT prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp','lock_timeout=5s']
   FROM pg_proc WHERE oid='public.list_home_current_residency_claims(uuid,uuid)'::regprocedure), 'Queue must use fixed security/timeout settings';
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.list_home_current_residency_claims(pg_temp.rq_id(100),pg_temp.rq_id(1));
   RAISE EXCEPTION 'Direct authenticated SQL queue execution was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO auth.users(id,email,last_sign_in_at) SELECT pg_temp.rq_id(n),'queue-contract-'||n||'@example.invalid',now()
 FROM generate_series(1,33)n;
INSERT INTO public."User"(id,email,username,name,date_of_birth)
 SELECT id,email,'queue_public_'||right(id::text,2),'Private legal fixture name',current_date-interval '25 years'
 FROM auth.users WHERE id::text LIKE 'ddc27300-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode)
 VALUES(pg_temp.rq_id(100),pg_temp.rq_id(1),pg_temp.rq_id(1),'273 Queue Contract Street','Test','WA','98607'),
 (pg_temp.rq_id(101),pg_temp.rq_id(1),pg_temp.rq_id(1),'274 Empty Queue Street','Test','WA','98607');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner)
 VALUES(pg_temp.rq_id(100),pg_temp.rq_id(1),'verified',true),(pg_temp.rq_id(101),pg_temp.rq_id(1),'verified',true);
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,verification_status,start_at,access_start_at)
 VALUES(pg_temp.rq_id(100),pg_temp.rq_id(1),'owner','owner','adult',true,'verified',now()-interval '1 day',now()-interval '1 day');
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.rq_id(100); a uuid:=pg_temp.rq_id(1); r jsonb; n integer; BEGIN
 ASSERT public.list_home_current_residency_claims(NULL,a)->>'code'='RESIDENCY_CLAIMS_INVALID';
 ASSERT public.list_home_current_residency_claims(h,NULL)->>'code'='RESIDENCY_CLAIMS_INVALID';
 ASSERT public.list_home_current_residency_claims(pg_temp.rq_id(999),a)->>'code'='HOME_NOT_FOUND';
 ASSERT public.list_home_current_residency_claims(pg_temp.rq_id(101),a)->'claims'='[]'::jsonb;
 ASSERT public.list_home_current_residency_claims(pg_temp.rq_id(101),pg_temp.rq_id(33))->>'code'='MEMBERS_MANAGE_REQUIRED', 'Empty still requires authority';
 FOR n IN 2..31 LOOP
   r:=public.submit_legacy_home_residency(h,pg_temp.rq_id(n),jsonb_build_object(
     'claimed_role',CASE WHEN n%2=0 THEN 'tenant' ELSE 'member' END,'claimed_address','Private asserted address'));
   ASSERT r->>'ok'='true' AND r->>'routing'='household_review', 'Actual synthetic admission must save pending claims';
 END LOOP;
END $$;
RESET ROLE;
-- Explicit historical fixtures: R02 already permits/preserves these null dates
-- and aliases. This is not a new submission date or a positive permission grant.
UPDATE public."HomeResidencyClaim" SET created_at='2026-09-13 01:02:03.000004+00',review_note='Private former note'
 WHERE home_id=pg_temp.rq_id(100);
UPDATE public."HomeResidencyClaim" SET created_at=NULL WHERE home_id=pg_temp.rq_id(100) AND user_id IN (pg_temp.rq_id(30),pg_temp.rq_id(31));
UPDATE public."HomeResidencyClaim" SET claimed_role='historical_unknown' WHERE home_id=pg_temp.rq_id(100) AND user_id=pg_temp.rq_id(29);
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.rq_id(100); a uuid:=pg_temp.rq_id(1); r jsonb; again jsonb; x jsonb; before_state jsonb;
 ids jsonb; token text; claim_id uuid; receipt jsonb; n integer; BEGIN
 before_state:=pg_temp.rq_state(h);
 r:=public.list_home_current_residency_claims(h,a);
 ASSERT r->>'ok'='true' AND r->>'home_id'=h::text AND r->>'actor_id'=a::text;
 ASSERT jsonb_array_length(r->'claims')=30, 'The complete queue must not silently truncate at 20';
 SELECT jsonb_agg(c.id ORDER BY c.created_at DESC NULLS LAST,c.id DESC) INTO ids FROM public."HomeResidencyClaim" c WHERE home_id=h AND status='pending';
 ASSERT (SELECT jsonb_agg(value->'id') FROM jsonb_array_elements(r->'claims'))=ids, 'Stable date/id order, nulls last';
 ASSERT r->'claims'->28->'created_at'='null'::jsonb AND r->'claims'->29->'created_at'='null'::jsonb, 'Preserve known legacy unavailable date';
 FOR x IN SELECT value FROM jsonb_array_elements(r->'claims') LOOP
   ASSERT (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(x) k)=ARRAY['claimant','claimed_role','created_at','home_id','id','status','user_id'];
   ASSERT (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(x->'claimant') k)=ARRAY['id','name','username'];
   ASSERT x->>'status'='pending' AND x->>'home_id'=h::text AND x->'claimant'->'id'=x->'user_id' AND x->'claimant'->'name'='null'::jsonb;
   IF x->>'user_id'=pg_temp.rq_id(29)::text THEN ASSERT x->'claimed_role'='null'::jsonb;
   ELSE ASSERT x->>'claimed_role' IN ('household','renter'); END IF;
 END LOOP;
 ASSERT r::text NOT LIKE '%Private%' AND r::text NOT LIKE '%example.invalid%', 'No raw legal name, note, address or email';
 again:=public.list_home_current_residency_claims(h,a);
 ASSERT again=r AND pg_temp.rq_state(h)=before_state, 'Repeated queue reads must preserve all owned state and role defaults';
 ASSERT public.list_home_current_residency_claims(h,pg_temp.rq_id(2))->>'code'='MEMBERS_MANAGE_REQUIRED';
 ASSERT pg_temp.rq_state(h)=before_state, 'Denied read must preserve current claims/membership/originals';

 -- The actual rejection/resubmission/approval path controls queue membership.
 SELECT c.id,public.home_residency_review_snapshot(c) INTO claim_id,token FROM public."HomeResidencyClaim" c WHERE home_id=h AND user_id=pg_temp.rq_id(2);
 r:=public.decide_home_residency_review(h,claim_id,a,'reject',NULL,'Private decision reason',pg_temp.rq_id(501),token);
 ASSERT r->>'ok'='true'; receipt:=r->'receipt';
 before_state:=pg_temp.rq_state(h); r:=public.list_home_current_residency_claims(h,a);
 ASSERT jsonb_array_length(r->'claims')=29 AND NOT EXISTS(SELECT FROM jsonb_array_elements(r->'claims') x WHERE x->>'id'=claim_id::text);
 ASSERT pg_temp.rq_state(h)=before_state;
 r:=public.submit_legacy_home_residency(h,pg_temp.rq_id(2),'{}'); ASSERT r->>'ok'='true' AND r->'claim'->>'id'=claim_id::text;
 r:=public.list_home_current_residency_claims(h,a); ASSERT jsonb_array_length(r->'claims')=30;
 SELECT public.home_residency_review_snapshot(c) INTO token FROM public."HomeResidencyClaim" c WHERE id=claim_id;
 r:=public.decide_home_residency_review(h,claim_id,a,'approve','member',NULL,pg_temp.rq_id(502),token); ASSERT r->>'ok'='true';
 before_state:=pg_temp.rq_state(h); r:=public.list_home_current_residency_claims(h,a);
 ASSERT jsonb_array_length(r->'claims')=29 AND NOT EXISTS(SELECT FROM jsonb_array_elements(r->'claims') x WHERE x->>'id'=claim_id::text);
 ASSERT pg_temp.rq_state(h)=before_state;
 ASSERT (SELECT result->>'status'='rejected' FROM public."HomeResidencyReviewReceipt" WHERE id=(receipt->>'id')::uuid), 'Queue does not rewrite earlier rejection';

 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,a,'members.manage',false);
 before_state:=pg_temp.rq_state(h); r:=public.list_home_current_residency_claims(h,a);
 ASSERT r->>'code'='MEMBERS_MANAGE_REQUIRED' AND NOT r ? 'claims' AND pg_temp.rq_state(h)=before_state;
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=a AND permission='members.manage';
 UPDATE public."Home" SET security_state='frozen' WHERE id=h;
 ASSERT public.list_home_current_residency_claims(h,a)->>'code'='MEMBERS_MANAGE_REQUIRED';
 UPDATE public."Home" SET security_state='normal',home_status='archived' WHERE id=h;
 ASSERT public.list_home_current_residency_claims(h,a)->>'code'='MEMBERS_MANAGE_REQUIRED';
 UPDATE public."Home" SET home_status='active' WHERE id=h;
 UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()-interval '1 second' WHERE home_id=h AND user_id=a;
 ASSERT public.list_home_current_residency_claims(h,a)->>'code'='MEMBERS_MANAGE_REQUIRED', 'Owner fallback must not bypass ended authority';
 UPDATE public."HomeOccupancy" SET access_end_at=NULL,start_at=clock_timestamp()+interval '1 day' WHERE home_id=h AND user_id=a;
 ASSERT public.list_home_current_residency_claims(h,a)->>'code'='MEMBERS_MANAGE_REQUIRED';
 UPDATE public."HomeOccupancy" SET start_at=clock_timestamp()-interval '1 day' WHERE home_id=h AND user_id=a;
 ASSERT public.list_home_current_residency_claims(h,a)->>'ok'='true';

 UPDATE public."HomeResidencyClaim" SET created_at='infinity' WHERE home_id=h AND user_id=pg_temp.rq_id(3);
 before_state:=pg_temp.rq_state(h); r:=public.list_home_current_residency_claims(h,a);
 ASSERT r->>'code'='RESIDENCY_CLAIMS_UNAVAILABLE' AND NOT r ? 'claims' AND pg_temp.rq_state(h)=before_state, 'Invalid timestamp is unavailable, not empty or rewritten';
END $$;
RESET ROLE;
ROLLBACK;
