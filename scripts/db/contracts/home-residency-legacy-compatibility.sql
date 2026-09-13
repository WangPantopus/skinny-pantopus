-- Old callers share atomic admission without invented UUID/address proof.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION pg_temp.legacy_u(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('ddc25600-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
INSERT INTO auth.users(id,email,last_sign_in_at) SELECT pg_temp.legacy_u(n),'legacy-contract-'||n||'@example.invalid',now()
  FROM generate_series(1,20)n;
INSERT INTO public."User"(id,email,username,name,date_of_birth) SELECT id,email,'legacy_contract_'||right(id::text,2),'Legacy fixture',
  CASE WHEN id=pg_temp.legacy_u(9) THEN current_date-interval '10 years' ELSE current_date-interval '25 years' END
  FROM auth.users WHERE id::text LIKE 'ddc25600-%';
INSERT INTO public."Home"(id,created_by_user_id,address,address2,city,state,zipcode) VALUES
  (pg_temp.legacy_u(100),pg_temp.legacy_u(1),'Legacy contract Home','Unit 2','Test','WA','98607'),
  (pg_temp.legacy_u(101),pg_temp.legacy_u(8),'Legacy creator Home',NULL,'Test','WA','98607'),
  (pg_temp.legacy_u(102),pg_temp.legacy_u(9),'Legacy child Home',NULL,'Test','WA','98607'),
  (pg_temp.legacy_u(103),pg_temp.legacy_u(1),'Legacy external Home',NULL,'Test','WA','98607'),
  (pg_temp.legacy_u(104),pg_temp.legacy_u(1),'Legacy stale Home',NULL,'Test','WA','98607');
-- A current owner record counts without an occupancy.
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES
  (pg_temp.legacy_u(100),pg_temp.legacy_u(1),'verified',true),
  (pg_temp.legacy_u(104),pg_temp.legacy_u(1),'verified',true);
CREATE FUNCTION pg_temp.fail_legacy_admission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.home_id=pg_temp.legacy_u(100) AND NEW.actor_user_id=pg_temp.legacy_u(4)
    AND NEW.action='residency_legacy_submission_saved' AND current_setting('pantopus.legacy_audit_failure',true)='yes' THEN
    RAISE EXCEPTION 'Synthetic late admission failure' USING ERRCODE='P0042';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER legacy_contract_audit_failure BEFORE INSERT ON public."HomeAuditLog"
  FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_legacy_admission();
CREATE FUNCTION pg_temp.stale_legacy_owner() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_temp AS $$
  UPDATE auth.users SET last_sign_in_at=now()-interval '60 days' WHERE id=pg_temp.legacy_u(1);
$$;
SET LOCAL ROLE service_role;
DO $$
DECLARE h uuid:=pg_temp.legacy_u(100); a uuid:=pg_temp.legacy_u(2); r jsonb; replay jsonb; claim uuid; occ uuid;
  before_claim jsonb; before_occ jsonb; before_card jsonb; card uuid; failed boolean:=false;
  request_id uuid:=pg_temp.legacy_u(500); cancelled_id uuid:=pg_temp.legacy_u(501); original jsonb;
  input jsonb; alias text; n integer:=12; count_before bigint;
  address jsonb:='{"line1":"Legacy contract Home","line2":"Unit 2","city":"Test","state":"WA","postal_code":"98607","country":"US"}';
BEGIN
  ASSERT NOT has_function_privilege('anon','public.submit_legacy_home_residency(uuid,uuid,jsonb)','EXECUTE');
  ASSERT NOT has_function_privilege('authenticated','public.save_home_residency_admission(uuid,uuid,text,text,jsonb,uuid)','EXECUTE');
  ASSERT NOT has_function_privilege('anon','public.home_residency_role_family(text)','EXECUTE');
  ASSERT NOT has_function_privilege('authenticated','public.get_legacy_home_residency_reviewers(uuid,uuid,uuid,timestamptz)','EXECUTE');
  ASSERT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public."HomeResidencyClaim"'::regclass
    AND conname='one_pending_claim_per_user_home' AND contype='u'), 'Full claim uniqueness must remain';
  r:=public.submit_legacy_home_residency(h,a,'{"claimed_address":"Unreviewed caller assertion"}');
  ASSERT r->>'ok'='true' AND r->>'created'='true' AND r->>'routing'='household_review';
  claim:=(r->'claim'->>'id')::uuid; occ:=(r->>'occupancy_id')::uuid;
  ASSERT r->'claim'->>'claimed_role'='member' AND r->'claim'->>'claimed_address'='Unreviewed caller assertion';
  ASSERT (SELECT verification_status='pending_approval' AND role_base='restricted_member' AND verified_at IS NULL
    AND NOT can_manage_tasks FROM public."HomeOccupancy" WHERE id=occ);
  ASSERT NOT EXISTS(SELECT FROM public."HomeResidencySubmissionCommand" WHERE actor_user_id=a), 'Legacy request invented a command';
  SELECT to_jsonb(c) INTO before_claim FROM public."HomeResidencyClaim"c WHERE id=claim;
  SELECT to_jsonb(o) INTO before_occ FROM public."HomeOccupancy"o WHERE id=occ;
  ASSERT public.get_legacy_home_residency_reviewers(h,a,claim,(before_claim->>'updated_at')::timestamptz)->'reviewer_ids'
    =jsonb_build_array(pg_temp.legacy_u(1)), 'Current owner without occupancy must receive review notice';
  ASSERT public.get_legacy_home_residency_reviewers(h,pg_temp.legacy_u(3),claim,(before_claim->>'updated_at')::timestamptz)->'reviewer_ids'='[]'::jsonb;
  ASSERT public.get_legacy_home_residency_reviewers(h,a,claim,(before_claim->>'updated_at')::timestamptz+interval '1 second')->'reviewer_ids'='[]'::jsonb;
  INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,pg_temp.legacy_u(1),'members.manage',false);
  ASSERT public.get_legacy_home_residency_reviewers(h,a,claim,(before_claim->>'updated_at')::timestamptz)->'reviewer_ids'='[]'::jsonb,
    'Revoked reviewer authority must not select recipients';
  DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=pg_temp.legacy_u(1) AND permission='members.manage';
  SELECT count(*) INTO count_before FROM public."HomeAuditLog" WHERE home_id=h;
  replay:=public.submit_legacy_home_residency(h,a,'{}');
  ASSERT replay->>'reused'='true' AND replay->'claim'=before_claim AND replay->>'occupancy_id'=occ::text;
  ASSERT (SELECT to_jsonb(o)=before_occ FROM public."HomeOccupancy"o WHERE id=occ);
  ASSERT (SELECT count(*)=count_before FROM public."HomeAuditLog" WHERE home_id=h), 'Retry duplicated audit';
  ASSERT public.submit_legacy_home_residency(h,a,'{"claimed_role":"renter"}')->>'code'='RESIDENCY_EXISTING_REQUEST';
  ASSERT public.submit_legacy_home_residency(h,a,'{"claimed_address":"Changed pending assertion"}')->>'code'='RESIDENCY_EXISTING_REQUEST';
  ASSERT (SELECT to_jsonb(c)=before_claim FROM public."HomeResidencyClaim"c WHERE id=claim);

  -- Repair the old partial write without replacing its role, address or proof.
  INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_role,claimed_address,status,created_at)
    VALUES(h,pg_temp.legacy_u(3),'tenant','Old stranded assertion','pending',NULL) RETURNING id INTO claim;
  r:=public.submit_legacy_home_residency(h,pg_temp.legacy_u(3),'{}');
  ASSERT r->>'ok'='true' AND r->'claim'->>'id'=claim::text AND r->'claim'->>'claimed_role'='tenant';
  ASSERT r->'claim'->>'claimed_address'='Old stranded assertion' AND r->'claim'->'created_at'='null'::jsonb;
  ASSERT (SELECT verification_status='pending_approval' AND role='tenant' FROM public."HomeOccupancy"
    WHERE id=(r->>'occupancy_id')::uuid);

  -- A rejected resubmission preserves the entire existing occupancy and denies.
  INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_role,claimed_address,status,reviewed_by,reviewed_at)
    VALUES(h,pg_temp.legacy_u(4),'tenant','Original rejected assertion','rejected',pg_temp.legacy_u(1),now()) RETURNING id INTO claim;
  INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,verification_status,
    start_at,access_end_at,can_manage_tasks)
    VALUES(h,pg_temp.legacy_u(4),'guest','guest','teen',true,'pending_approval',now()-interval '1 day',now()+interval '1 day',true)
    RETURNING id INTO occ;
  INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,pg_temp.legacy_u(4),'home.view',false);
  INSERT INTO public."HomePostcardCode"(home_id,user_id,code_hash,status,dispatch_status,vendor_job_id)
    VALUES(h,pg_temp.legacy_u(4),repeat('b',64),'pending','accepted','legacy-contract-postcard') RETURNING id INTO card;
  SELECT to_jsonb(c) INTO before_claim FROM public."HomeResidencyClaim"c WHERE id=claim;
  SELECT to_jsonb(o) INTO before_occ FROM public."HomeOccupancy"o WHERE id=occ;
  SELECT to_jsonb(c) INTO before_card FROM public."HomePostcardCode"c WHERE id=card;
  PERFORM set_config('pantopus.legacy_audit_failure','yes',true);
  BEGIN PERFORM public.submit_legacy_home_residency(h,pg_temp.legacy_u(4),'{}');
    EXCEPTION WHEN SQLSTATE 'P0042' THEN failed:=true; END;
  ASSERT failed, 'Late failure did not run';
  ASSERT (SELECT to_jsonb(c)=before_claim FROM public."HomeResidencyClaim"c WHERE id=claim);
  ASSERT (SELECT to_jsonb(o)=before_occ FROM public."HomeOccupancy"o WHERE id=occ);
  ASSERT (SELECT to_jsonb(c)=before_card FROM public."HomePostcardCode"c WHERE id=card);
  PERFORM set_config('pantopus.legacy_audit_failure','no',true);
  r:=public.submit_legacy_home_residency(h,pg_temp.legacy_u(4),'{}');
  ASSERT r->>'ok'='true' AND r->'claim'->>'claimed_role'='tenant' AND r->'claim'->>'status'='pending';
  ASSERT r->'claim'->>'claimed_address'='Original rejected assertion';
  ASSERT (SELECT to_jsonb(o)=before_occ FROM public."HomeOccupancy"o WHERE id=occ);
  ASSERT (SELECT NOT allowed FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=pg_temp.legacy_u(4) AND permission='home.view');
  ASSERT (SELECT status='cancelled' AND code_hash=before_card->>'code_hash'
    AND dispatch_status='accepted' AND vendor_job_id='legacy-contract-postcard' FROM public."HomePostcardCode" WHERE id=card);

  INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_role,status) VALUES(h,pg_temp.legacy_u(5),'member','verified');
  ASSERT public.submit_legacy_home_residency(h,pg_temp.legacy_u(5),'{}')->>'code'='RESIDENCY_ALREADY_VERIFIED';
  INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,end_at,verification_status)
    VALUES(h,pg_temp.legacy_u(6),'guest','guest',false,now()-interval '1 day','unverified') RETURNING id INTO occ;
  SELECT to_jsonb(o) INTO before_occ FROM public."HomeOccupancy"o WHERE id=occ;
  ASSERT public.submit_legacy_home_residency(h,pg_temp.legacy_u(6),'{}')->>'code'='MEMBERSHIP_RENEWAL_REQUIRED';
  ASSERT (SELECT to_jsonb(o)=before_occ FROM public."HomeOccupancy"o WHERE id=occ);
  ASSERT NOT EXISTS(SELECT FROM public."HomeResidencyClaim" WHERE home_id=h AND user_id=pg_temp.legacy_u(6));
  INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,start_at,verification_status)
    VALUES(h,pg_temp.legacy_u(7),'member','member',true,now()+interval '1 day','pending_approval');
  ASSERT public.submit_legacy_home_residency(h,pg_temp.legacy_u(7),'{}')->>'code'='MEMBERSHIP_RENEWAL_REQUIRED';

  r:=public.submit_legacy_home_residency(pg_temp.legacy_u(101),pg_temp.legacy_u(8),'{"claimed_role":"renter"}');
  ASSERT r->>'routing'='self_bootstrap' AND r->'claim'->>'cold_start_mode'='self_bootstrap';
  ASSERT (SELECT role_base='lease_resident' AND can_manage_tasks AND verification_status='provisional_bootstrap'
    FROM public."HomeOccupancy" WHERE id=(r->>'occupancy_id')::uuid);
  r:=public.submit_legacy_home_residency(pg_temp.legacy_u(102),pg_temp.legacy_u(9),'{"claimed_role":"household"}');
  ASSERT (SELECT age_band='child' AND NOT can_manage_tasks AND verified_at IS NULL
    FROM public."HomeOccupancy" WHERE id=(r->>'occupancy_id')::uuid);
  r:=public.submit_legacy_home_residency(pg_temp.legacy_u(103),pg_temp.legacy_u(10),'{}');
  ASSERT r->>'routing'='external_postcard';
  ASSERT NOT EXISTS(SELECT FROM public."HomePostcardCode" WHERE home_id=pg_temp.legacy_u(103));

  -- Original command identity/address fences remain intact across legacy reads.
  input:=jsonb_build_object('claimed_role','household','address',address);
  r:=public.submit_home_residency(h,pg_temp.legacy_u(11),request_id,input);
  ASSERT r->>'state'='completed' AND r->>'replayed'='false';
  original:=public.get_home_residency_submission(h,pg_temp.legacy_u(11),request_id);
  UPDATE public."Home" SET address2='Unit 3' WHERE id=h;
  ASSERT public.submit_legacy_home_residency(h,pg_temp.legacy_u(11),'{}')->>'ok'='true';
  ASSERT original=public.get_home_residency_submission(h,pg_temp.legacy_u(11),request_id);
  ASSERT original=public.cancel_home_residency_submission(h,pg_temp.legacy_u(11),request_id);
  ASSERT original=(public.submit_home_residency(h,pg_temp.legacy_u(11),request_id,input)-'replayed');
  ASSERT public.submit_home_residency(h,pg_temp.legacy_u(11),pg_temp.legacy_u(502),input)->>'code'='RESIDENCY_ADDRESS_CHANGED';
  ASSERT public.cancel_home_residency_submission(h,pg_temp.legacy_u(11),cancelled_id)->>'state'='cancelled';
  ASSERT public.submit_home_residency(h,pg_temp.legacy_u(11),cancelled_id,input)->>'state'='cancelled';
  UPDATE public."Home" SET address2='Unit 2' WHERE id=h;

  FOREACH alias IN ARRAY ARRAY['renter','tenant','lease_resident','household','member','family','roommate'] LOOP
    r:=public.submit_legacy_home_residency(h,pg_temp.legacy_u(n),jsonb_build_object('claimed_role',alias));
    ASSERT r->>'ok'='true' AND r->'claim'->>'claimed_role'=alias;
    n:=n+1;
  END LOOP;
  -- Canonical household is also valid when an old reviewer omits its role.
  SELECT id INTO claim FROM public."HomeResidencyClaim" WHERE home_id=h AND user_id=pg_temp.legacy_u(15);
  r:=public.decide_home_residency_review(h,claim,pg_temp.legacy_u(1),'approve',NULL,NULL,NULL,NULL,365);
  ASSERT r->>'ok'='true' AND r->'claim'->>'status'='verified' AND r->'occupancy'->>'role_base'='member';
  ASSERT r->'receipt'->>'legacy_request'='true';
  ASSERT (SELECT claimed_role='household' FROM public."HomeResidencyClaim" WHERE id=claim), 'Review changed original claimed role';
  FOREACH alias IN ARRAY ARRAY['owner','admin','manager','property_manager'] LOOP
    ASSERT public.submit_legacy_home_residency(h,pg_temp.legacy_u(20),jsonb_build_object('claimed_role',alias))->>'code'='OWNERSHIP_FLOW_REQUIRED';
  END LOOP;
  FOREACH alias IN ARRAY ARRAY['guest','caregiver','restricted_member','service_provider','unknown'] LOOP
    ASSERT public.submit_legacy_home_residency(h,pg_temp.legacy_u(20),jsonb_build_object('claimed_role',alias))->>'code'='RESIDENCY_SUBMISSION_INVALID';
  END LOOP;
  FOREACH input IN ARRAY ARRAY['[]'::jsonb,'{"claimed_role":[]}'::jsonb,'{"claimed_address":false}'::jsonb,
    '{"request_id":"not-a-legacy-proof"}'::jsonb] LOOP
    ASSERT public.submit_legacy_home_residency(h,pg_temp.legacy_u(20),input)->>'code'='RESIDENCY_SUBMISSION_INVALID';
  END LOOP;
  ASSERT NOT EXISTS(SELECT FROM public."HomeResidencyClaim" WHERE home_id=h AND user_id=pg_temp.legacy_u(20));
  PERFORM pg_temp.stale_legacy_owner();
  r:=public.submit_legacy_home_residency(pg_temp.legacy_u(104),pg_temp.legacy_u(20),'{}');
  ASSERT r->>'routing'='stale_authority_postcard';
  ASSERT NOT EXISTS(SELECT FROM public."HomePostcardCode" WHERE home_id=pg_temp.legacy_u(104));
END $$;
ROLLBACK;
