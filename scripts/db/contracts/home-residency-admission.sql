-- Exercise actual shipped roles and service-role transactions, not a synthetic
-- role matrix. All fixture grants are local explicit overrides and roll back.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public,extensions,pg_catalog;
CREATE TEMP TABLE admission_roles_before AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows
  FROM public."HomeRolePermission" r;
DO $$ BEGIN
  IF (SELECT count(*) FROM public."HomeRolePermission")<>29 THEN RAISE EXCEPTION 'Expected shipped role rows'; END IF;
  IF has_function_privilege('authenticated','public.review_home_residency(uuid,uuid,text,jsonb,integer)','EXECUTE')
    OR has_function_privilege('anon','public.review_home_residency(uuid,uuid,text,jsonb,integer)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.review_home_residency(uuid,uuid,text,jsonb,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Residency RPC privilege is unsafe'; END IF;
  IF has_table_privilege('authenticated','public."HomeResidencyClaim"','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege('anon','public."HomeResidencyClaim"','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'Direct claim authority writes remain available'; END IF;
END $$;
INSERT INTO auth.users(id,email) SELECT ('dde00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'home-admission-'||n||'@example.invalid' FROM generate_series(1,12)n;
INSERT INTO public."User"(id,email,username,name)
  SELECT id,email,'home_admission_'||right(id::text,2),'Home admission fixture'
  FROM auth.users WHERE id::text LIKE 'dde00000-0000-4000-8000-%';
INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES
  ('dde00000-0000-4000-8000-000000000100','dde00000-0000-4000-8000-000000000001','100 Admission Test','Test','WA','98607');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,verification_status,
  start_at,end_at,access_start_at,access_end_at)
SELECT 'dde00000-0000-4000-8000-000000000100',('dde00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  role,role::public.home_role_base,age::public.home_age_band,true,status,
  now()-interval '2 days',now()+interval '3 days',now()-interval '1 day',now()+interval '1 day'
FROM (VALUES(1,'owner','adult','verified'),(2,'admin','adult','verified'),(3,'member',NULL,'pending_doc'),
  (4,'restricted_member','child','pending_approval'),(5,'member','teen','pending_approval'),
  (6,'lease_resident',NULL,'verified'),(7,'member','adult','pending_doc'),
  (8,'member','adult','pending_doc')) f(n,role,age,status);
INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES
 ('dde00000-0000-4000-8000-000000000100','dde00000-0000-4000-8000-000000000002','members.manage',true),
 ('dde00000-0000-4000-8000-000000000100','dde00000-0000-4000-8000-000000000003','finance.manage',false),
 ('dde00000-0000-4000-8000-000000000100','dde00000-0000-4000-8000-000000000007','finance.manage',true);
INSERT INTO public."HomeResidencyClaim"(id,home_id,user_id,claimed_address,claimed_role)
 SELECT ('dde00000-0000-4000-8000-'||lpad((n+200)::text,12,'0'))::uuid,
  'dde00000-0000-4000-8000-000000000100',('dde00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  '100 Admission Test','member' FROM generate_series(1,12)n;
CREATE FUNCTION pg_temp.expect_admission(r jsonb,code text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF r->>'code' IS DISTINCT FROM code THEN RAISE EXCEPTION 'Expected %, got %',code,r; END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$ DECLARE
 h uuid:='dde00000-0000-4000-8000-000000000100'; owner_id uuid:='dde00000-0000-4000-8000-000000000001';
 admin_id uuid:='dde00000-0000-4000-8000-000000000002'; pending_id uuid:='dde00000-0000-4000-8000-000000000003';
 child_id uuid:='dde00000-0000-4000-8000-000000000004'; teen_id uuid:='dde00000-0000-4000-8000-000000000005';
 verified_id uuid:='dde00000-0000-4000-8000-000000000006'; overridden_id uuid:='dde00000-0000-4000-8000-000000000007';
 renewal_id uuid:='dde00000-0000-4000-8000-000000000008'; new_id uuid:='dde00000-0000-4000-8000-000000000009';
 claim_id uuid:='dde00000-0000-4000-8000-000000000203'; r jsonb; original jsonb; after_row jsonb;
 original_claim jsonb; state text; role_name text; n integer;
BEGIN
 SELECT to_jsonb(o) INTO original FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=pending_id;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'approve',jsonb_build_object('claim_id',claim_id)), 'MEMBERSHIP_CONFIRMED');
 SELECT to_jsonb(o) INTO after_row FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=pending_id;
 IF (after_row - ARRAY['verification_status','verified_at','verification_expires_at','updated_at','can_manage_tasks'])
   IS DISTINCT FROM (original - ARRAY['verification_status','verified_at','verification_expires_at','updated_at','can_manage_tasks'])
   OR after_row->>'verification_status'<>'verified' OR after_row->>'verified_at' IS NULL
   OR (after_row->>'verification_expires_at')::timestamptz-(after_row->>'verified_at')::timestamptz<>interval '365 days'
   OR public.home_has_permission(h,'finance.manage',pending_id) OR (after_row->>'can_manage_tasks')::boolean THEN
   RAISE EXCEPTION 'Approval reset age/window/deny/provenance or manufactured unseeded permission'; END IF;
 SELECT count(*) INTO n FROM public."HomeAuditLog" WHERE home_id=h;
 r:=public.review_home_residency(h,owner_id,'approve',jsonb_build_object('claim_id',claim_id,'role','lease_resident'));
 IF r->>'replayed'<>'true' OR r->'occupancy' IS DISTINCT FROM after_row
   OR (SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=h)<>n THEN RAISE EXCEPTION 'Approval retry reapplied role or audit'; END IF;
 UPDATE public."HomeOccupancy" SET is_active=false,verification_status='moved_out' WHERE home_id=h AND user_id=pending_id;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'approve',jsonb_build_object('claim_id',claim_id)), 'MEMBERSHIP_RENEWAL_REQUIRED');
 UPDATE public."HomeOccupancy" SET is_active=true,verification_status='verified' WHERE home_id=h AND user_id=pending_id;
 SELECT to_jsonb(o) INTO original FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=verified_id;
 r:=public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',verified_id));
 IF r->>'replayed'<>'true' OR r->'occupancy' IS DISTINCT FROM original THEN RAISE EXCEPTION 'Verified attach reset existing membership'; END IF;
 r:=public.review_home_residency(h,owner_id,'approve',jsonb_build_object('claim_id','dde00000-0000-4000-8000-000000000206','role','guest'));
 IF r->'occupancy' IS DISTINCT FROM original THEN RAISE EXCEPTION 'Claim approval demoted a verified resident'; END IF;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',owner_id)), 'SELF_ADMISSION_FORBIDDEN');
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'approve',jsonb_build_object('claim_id','dde00000-0000-4000-8000-000000000201')), 'SELF_ADMISSION_FORBIDDEN');
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,admin_id,'attach',jsonb_build_object('target_id',owner_id)), 'OWNERSHIP_FLOW_REQUIRED');
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,admin_id,'attach',jsonb_build_object('target_id',overridden_id)), 'PERMISSION_DELEGATION_FORBIDDEN');
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,admin_id,'approve',jsonb_build_object('claim_id','dde00000-0000-4000-8000-000000000208','role','lease_resident')), 'PERMISSION_DELEGATION_FORBIDDEN');
 FOREACH role_name IN ARRAY ARRAY['owner','admin','manager','property_manager','unknown'] LOOP
   UPDATE public."HomeResidencyClaim" SET claimed_role=role_name WHERE id='dde00000-0000-4000-8000-000000000208';
   PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'approve',jsonb_build_object('claim_id','dde00000-0000-4000-8000-000000000208')), 'RESIDENCY_ROLE_FORBIDDEN');
 END LOOP;
 UPDATE public."HomeResidencyClaim" SET claimed_role='member' WHERE id='dde00000-0000-4000-8000-000000000208';
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'approve',jsonb_build_object('claim_id','dde00000-0000-4000-8000-000000000204','role','member')), 'PROPOSED_ROLE_FORBIDDEN');
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'approve',jsonb_build_object('claim_id','dde00000-0000-4000-8000-000000000205','role','lease_resident')), 'PROPOSED_ROLE_FORBIDDEN');
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,child_id,'finance.manage',true),(h,teen_id,'finance.manage',true);
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',child_id)), 'MEMBERSHIP_CONFIRMED');
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',teen_id)), 'MEMBERSHIP_CONFIRMED');
 IF public.home_has_permission(h,'finance.manage',child_id) OR public.home_has_permission(h,'finance.manage',teen_id)
   OR NOT EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=h AND user_id=child_id AND age_band='child')
   OR NOT EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=h AND user_id=teen_id AND age_band='teen') THEN
   RAISE EXCEPTION 'Admission escaped explicit minor ceiling'; END IF;
 FOREACH state IN ARRAY ARRAY['revoked','suspended','inactive','moved_out','unknown',NULL] LOOP
   UPDATE public."HomeOccupancy" SET verification_status=state WHERE home_id=h AND user_id=renewal_id;
   PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',renewal_id)), 'MEMBERSHIP_RENEWAL_REQUIRED');
 END LOOP;
 UPDATE public."HomeOccupancy" SET verification_status='pending_doc',verified_at=now()-interval '1 year' WHERE home_id=h AND user_id=renewal_id;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',renewal_id)), 'MEMBERSHIP_RENEWAL_REQUIRED');
 UPDATE public."HomeOccupancy" SET verified_at=NULL,access_end_at=now() WHERE home_id=h AND user_id=renewal_id;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',renewal_id)), 'MEMBERSHIP_RENEWAL_REQUIRED');
 UPDATE public."HomeOccupancy" SET access_end_at=now()+interval '1 day',start_at=now()+interval '2 days' WHERE home_id=h AND user_id=renewal_id;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',renewal_id)), 'MEMBERSHIP_RENEWAL_REQUIRED');
 UPDATE public."HomeOccupancy" SET start_at=now()+interval '1 hour' WHERE home_id=h AND user_id=renewal_id;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',renewal_id)), 'MEMBERSHIP_CONFIRMED');
 IF public.home_is_active_member(h,renewal_id) OR EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=h AND user_id=renewal_id
   AND (start_at<>now()+interval '1 hour' OR can_manage_home OR can_manage_tasks)) THEN RAISE EXCEPTION 'Scheduled access began early'; END IF;
 -- Ordinary verified owner must respect denies, state, explicit age and proof.
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,owner_id,'members.manage',false);
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',new_id)), 'MEMBERS_MANAGE_REQUIRED');
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=owner_id;
 FOREACH state IN ARRAY ARRAY['pending_doc','revoked','suspended',NULL] LOOP
   UPDATE public."HomeOccupancy" SET verification_status=state WHERE home_id=h AND user_id=owner_id;
   PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',new_id)), 'MEMBERS_MANAGE_REQUIRED');
 END LOOP;
 UPDATE public."HomeOccupancy" SET verification_status='verified',age_band='child' WHERE home_id=h AND user_id=owner_id;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',new_id)), 'MEMBERS_MANAGE_REQUIRED');
 UPDATE public."HomeOccupancy" SET age_band='adult',access_end_at=now() WHERE home_id=h AND user_id=owner_id;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',new_id)), 'MEMBERS_MANAGE_REQUIRED');
 UPDATE public."HomeOccupancy" SET access_end_at=now()+interval '1 day' WHERE home_id=h AND user_id=owner_id;
 FOREACH state IN ARRAY ARRAY['revoked','disputed'] LOOP
   INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status) VALUES(h,owner_id,state::public.owner_status_type);
   PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',new_id)), 'MEMBERS_MANAGE_REQUIRED');
   DELETE FROM public."HomeOwner" WHERE home_id=h AND subject_id=owner_id;
 END LOOP;
 UPDATE public."Home" SET security_state='frozen' WHERE id=h;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',new_id)), 'MEMBERS_MANAGE_REQUIRED');
 UPDATE public."Home" SET security_state='normal' WHERE id=h;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'attach',jsonb_build_object('target_id',new_id)), 'MEMBERSHIP_CONFIRMED');
 IF NOT public.home_is_active_member(h,new_id) OR public.home_has_permission(h,'tasks.edit',new_id) THEN
   RAISE EXCEPTION 'New unknown-age compatibility changed shipped ordinary grants'; END IF;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'approve',jsonb_build_object('claim_id','dde00000-0000-4000-8000-000000000999')), 'CLAIM_NOT_FOUND');
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'reject',jsonb_build_object('claim_id',claim_id)), 'CLAIM_NOT_PENDING');
 r:=public.review_home_residency(h,owner_id,'reject',jsonb_build_object('claim_id','dde00000-0000-4000-8000-000000000210','reason','private reason'));
 PERFORM pg_temp.expect_admission(r,'CLAIM_REJECTED');
 IF r ? 'reason' OR r ? 'review_note' THEN RAISE EXCEPTION 'Private review reason leaked'; END IF;
 r:=public.review_home_residency(h,owner_id,'reject',jsonb_build_object('claim_id','dde00000-0000-4000-8000-000000000210'));
 IF r->>'replayed'<>'true' THEN RAISE EXCEPTION 'Exact rejection retry not recognized'; END IF;
 PERFORM pg_temp.expect_admission(public.review_home_residency(h,owner_id,'approve',jsonb_build_object('claim_id','dde00000-0000-4000-8000-000000000210')), 'CLAIM_NOT_PENDING');
END $$;
RESET ROLE;
-- Induced audit failure proves there is no "approved but no membership" result.
CREATE FUNCTION pg_temp.reject_admission_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.home_id='dde00000-0000-4000-8000-000000000100' AND NEW.action='residency_claim_approved' THEN
   RAISE EXCEPTION 'fixture admission audit failure' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER admission_fixture_audit_failure BEFORE INSERT ON public."HomeAuditLog"
 FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_admission_audit();
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
   PERFORM public.review_home_residency('dde00000-0000-4000-8000-000000000100','dde00000-0000-4000-8000-000000000001',
     'approve','{"claim_id":"dde00000-0000-4000-8000-000000000211"}');
   RAISE EXCEPTION 'Expected audit rollback';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id='dde00000-0000-4000-8000-000000000100'
   AND user_id='dde00000-0000-4000-8000-000000000011') OR NOT EXISTS(SELECT FROM public."HomeResidencyClaim"
   WHERE id='dde00000-0000-4000-8000-000000000211' AND status='pending' AND reviewed_by IS NULL) THEN
   RAISE EXCEPTION 'Failed approval left partial claim or membership'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT rows FROM admission_roles_before) IS DISTINCT FROM
   (SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission" r) THEN
   RAISE EXCEPTION 'Admission changed role defaults'; END IF;
END $$;
ROLLBACK;
