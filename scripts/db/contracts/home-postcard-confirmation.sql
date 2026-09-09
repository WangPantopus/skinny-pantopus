-- Atomic proof consumption, rollback, member ceiling and live access on retry.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id,email) VALUES
 ('eee00000-0000-4000-8000-000000000091','postcard-confirm-1@example.invalid'),
 ('eee00000-0000-4000-8000-000000000092','postcard-confirm-2@example.invalid'),
 ('eee00000-0000-4000-8000-000000000093','postcard-confirm-3@example.invalid');
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'postcard_confirm_'||right(id::text,2),'Postcard confirmation contract'
 FROM auth.users WHERE id IN ('eee00000-0000-4000-8000-000000000091','eee00000-0000-4000-8000-000000000092','eee00000-0000-4000-8000-000000000093');
INSERT INTO public."Home"(id,address,address2,city,state,zipcode) VALUES
 ('eee00000-0000-4000-8000-000000000094','Synthetic confirmation','Apt 4','Test','CA','00000');
INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_role,status) VALUES
 ('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000091','owner','pending');
CREATE FUNCTION pg_temp.postcard_templates() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object(
 'adult',jsonb_build_object('role_base','member','can_manage_home',false,'can_manage_access',false,'can_manage_finance',false,'can_manage_tasks',true,'can_view_sensitive',true),
 'child',jsonb_build_object('role_base','member','can_manage_home',false,'can_manage_access',false,'can_manage_finance',false,'can_manage_tasks',false,'can_view_sensitive',false),
 'teen',jsonb_build_object('role_base','member','can_manage_home',false,'can_manage_access',false,'can_manage_finance',false,'can_manage_tasks',true,'can_view_sensitive',false),
 'provisional',jsonb_build_object('role_base','restricted_member','can_manage_home',false,'can_manage_access',false,'can_manage_finance',false,'can_manage_tasks',false,'can_view_sensitive',false)); $$;
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.confirm_home_postcard(uuid,uuid,text,jsonb,integer)','execute')
 OR has_function_privilege('anon','public.confirm_home_postcard(uuid,uuid,text,jsonb,integer)','execute')
 OR NOT has_function_privilege('service_role','public.confirm_home_postcard(uuid,uuid,text,jsonb,integer)','execute') THEN
 RAISE EXCEPTION 'Incorrect confirmation grants'; END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb;
BEGIN
 r:=public.admit_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000091',repeat('a',64));
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000092',repeat('a',64),pg_temp.postcard_templates(),730);
 IF r->>'error' IS DISTINCT FROM 'NO_POSTCARD' THEN RAISE EXCEPTION 'Foreign proof accepted'; END IF;
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000091',repeat('b',64),pg_temp.postcard_templates(),730);
 IF r->>'error' IS DISTINCT FROM 'WRONG_CODE' OR r->>'attempts_remaining' IS DISTINCT FROM '4' THEN RAISE EXCEPTION 'Wrong code did not count'; END IF;
END $$;
RESET ROLE;
-- Fail after both proof and membership writes. The entire confirmation must roll back.
CREATE FUNCTION pg_temp.reject_postcard_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Contract audit failure'; END $$;
CREATE TRIGGER postcard_contract_audit_failure BEFORE INSERT ON public."HomeAuditLog" FOR EACH ROW
 WHEN (NEW.action='POSTCARD_CODE_VERIFIED') EXECUTE FUNCTION pg_temp.reject_postcard_audit();
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000091',repeat('a',64),pg_temp.postcard_templates(),730);
  RAISE EXCEPTION 'Expected audit failure missing';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Contract audit failure' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id='eee00000-0000-4000-8000-000000000094')
 OR NOT EXISTS(SELECT FROM public."HomePostcardCode" WHERE home_id='eee00000-0000-4000-8000-000000000094' AND status='pending' AND attempts=1)
 OR NOT EXISTS(SELECT FROM public."HomeResidencyClaim" WHERE home_id='eee00000-0000-4000-8000-000000000094' AND status='pending') THEN
 RAISE EXCEPTION 'Failed confirmation partially committed'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER postcard_contract_audit_failure ON public."HomeAuditLog";
SET LOCAL ROLE service_role;
DO $$ DECLARE first_result jsonb; r jsonb; original_occ jsonb;
BEGIN
 first_result:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000091',repeat('a',64),pg_temp.postcard_templates(),730);
 IF first_result->'occupancy'->>'role_base' IS DISTINCT FROM 'member' OR first_result->'occupancy'->>'verification_status' IS DISTINCT FROM 'verified'
 OR first_result->'occupancy'->>'can_manage_home' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Mail granted self-claimed ownership'; END IF;
 IF EXISTS(SELECT FROM public."HomeOwner" WHERE home_id='eee00000-0000-4000-8000-000000000094') THEN RAISE EXCEPTION 'Mail created ownership'; END IF;
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000091',repeat('a',64),pg_temp.postcard_templates(),730);
 IF r->>'reused' IS DISTINCT FROM 'true' OR r->'occupancy' IS DISTINCT FROM first_result->'occupancy'
 OR (SELECT attempts FROM public."HomePostcardCode" WHERE user_id='eee00000-0000-4000-8000-000000000091')<>2 THEN
 RAISE EXCEPTION 'Successful retry changed membership or counters'; END IF;
 UPDATE public."HomeOccupancy" SET is_active=false,end_at=now() WHERE home_id='eee00000-0000-4000-8000-000000000094';
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000091',repeat('a',64),pg_temp.postcard_templates(),730);
 IF r->>'error' IS DISTINCT FROM 'ACCESS_REVOKED' THEN RAISE EXCEPTION 'Retry resurrected removed member'; END IF;
 UPDATE public."HomeOccupancy" SET is_active=true,end_at=NULL,role_base='owner',role='owner' WHERE home_id='eee00000-0000-4000-8000-000000000094';
 UPDATE public."Home" SET address2='Apt 5' WHERE id='eee00000-0000-4000-8000-000000000094';
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000091',repeat('a',64),pg_temp.postcard_templates(),730);
 IF r->>'error' IS DISTINCT FROM 'ADDRESS_CHANGED' THEN RAISE EXCEPTION 'Code moved to another unit'; END IF;
 UPDATE public."Home" SET address2='Apt 4' WHERE id='eee00000-0000-4000-8000-000000000094';
 r:=public.admit_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000092',repeat('b',64));
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000092',repeat('b',64),pg_temp.postcard_templates(),730);
 IF r->'occupancy'->>'verification_status' IS DISTINCT FROM 'provisional'
 OR r->'occupancy'->>'role_base' IS DISTINCT FROM 'restricted_member'
 OR r->'occupancy'->>'can_view_sensitive' IS DISTINCT FROM 'false'
 OR r->'occupancy'->>'challenge_window_ends_at' IS NULL THEN RAISE EXCEPTION 'Existing household was bypassed'; END IF;
 original_occ:=r->'occupancy';
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000092',repeat('b',64),pg_temp.postcard_templates(),730);
 IF r->'occupancy' IS DISTINCT FROM original_occ THEN RAISE EXCEPTION 'Retry reset challenge clock'; END IF;
 r:=public.admit_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000093',repeat('c',64));
 FOR i IN 1..6 LOOP
  r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000093',repeat('d',64),pg_temp.postcard_templates(),730);
 END LOOP;
 IF r->>'error' IS DISTINCT FROM 'LOCKED' OR (SELECT attempts FROM public."HomePostcardCode" WHERE user_id='eee00000-0000-4000-8000-000000000093')<>5 THEN RAISE EXCEPTION 'Attempt cap bypassed'; END IF;
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000093',repeat('c',64),pg_temp.postcard_templates(),730);
 IF r->>'error' IS DISTINCT FROM 'LOCKED' THEN RAISE EXCEPTION 'Correct code bypassed exhausted attempts'; END IF;
 -- Existing independently granted ownership is retained, never reset by a new card.
 SELECT to_jsonb(o) INTO original_occ FROM public."HomeOccupancy" o WHERE user_id='eee00000-0000-4000-8000-000000000091';
 r:=public.admit_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000091',repeat('e',64));
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000091',repeat('e',64),pg_temp.postcard_templates(),730);
 IF r->'occupancy' IS DISTINCT FROM original_occ THEN RAISE EXCEPTION 'Mail reset existing ownership'; END IF;
 -- Reuse only owned contract rows for denial and child-policy cases.
 UPDATE public."HomePostcardCode" SET status='pending',attempts=0 WHERE user_id='eee00000-0000-4000-8000-000000000093';
 UPDATE public."Home" SET security_state='frozen' WHERE id='eee00000-0000-4000-8000-000000000094';
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000093',repeat('c',64),pg_temp.postcard_templates(),730);
 IF r->>'error' IS DISTINCT FROM 'ACCESS_REVOKED' THEN RAISE EXCEPTION 'Frozen home accepted mail proof'; END IF;
 UPDATE public."Home" SET security_state='normal' WHERE id='eee00000-0000-4000-8000-000000000094';
 INSERT INTO public."HomeResidencyClaim"(home_id,user_id,status) VALUES ('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000093','rejected');
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000093',repeat('c',64),pg_temp.postcard_templates(),730);
 IF r->>'error' IS DISTINCT FROM 'ACCESS_REVOKED' THEN RAISE EXCEPTION 'Rejected residency accepted mail proof'; END IF;
 UPDATE public."HomeResidencyClaim" SET status='pending' WHERE user_id='eee00000-0000-4000-8000-000000000093';
 UPDATE public."HomeOccupancy" SET role_base='member',role='member' WHERE home_id='eee00000-0000-4000-8000-000000000094';
 INSERT INTO public."HomeOccupancy"(home_id,user_id,age_band,role_base,verification_status) VALUES
 ('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000093','child','restricted_member','pending_postcard');
 r:=public.confirm_home_postcard('eee00000-0000-4000-8000-000000000094','eee00000-0000-4000-8000-000000000093',repeat('c',64),pg_temp.postcard_templates(),730);
 IF r->'occupancy'->>'can_view_sensitive' IS DISTINCT FROM 'false' OR r->'occupancy'->>'can_manage_tasks' IS DISTINCT FROM 'false'
 OR r->'occupancy'->>'age_band' IS DISTINCT FROM 'child' THEN RAISE EXCEPTION 'Confirmation discarded child restrictions'; END IF;

END $$;
RESET ROLE;
ROLLBACK;
