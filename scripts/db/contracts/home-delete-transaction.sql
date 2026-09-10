-- Exact deletion authority, private setup, storage retention and atomic rollback.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
INSERT INTO auth.users (id,email) VALUES
 ('ddd30000-0000-4000-8000-000000000001','home-delete-one@example.invalid'),
 ('ddd30000-0000-4000-8000-000000000002','home-delete-two@example.invalid');
INSERT INTO public."User" (id,email,username,name)
 SELECT id,email,'home_delete_' || right(id::text,1),'Home deletion fixture' FROM auth.users
 WHERE id IN ('ddd30000-0000-4000-8000-000000000001','ddd30000-0000-4000-8000-000000000002');
INSERT INTO public."Home" (id,owner_id,created_by_user_id,address,city,state,zipcode)
 SELECT ('ddd30000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 CASE WHEN n IN (10,50,60) THEN 'ddd30000-0000-4000-8000-000000000001'::uuid
      WHEN n=30 THEN 'ddd30000-0000-4000-8000-000000000002'::uuid END,
 'ddd30000-0000-4000-8000-000000000001', 'Synthetic deletion fixture','Synthetic City','WA','98607'
 FROM unnest(ARRAY[10,20,30,40,50,60]) n;
INSERT INTO public."HomeOwner" (home_id,subject_id,subject_type,owner_status,is_primary_owner) VALUES
 ('ddd30000-0000-4000-8000-000000000020','ddd30000-0000-4000-8000-000000000001','user','verified',true),
 ('ddd30000-0000-4000-8000-000000000040','ddd30000-0000-4000-8000-000000000001','user','pending',true);
INSERT INTO public."HomeOccupancy" (home_id,user_id,role,role_base,verification_status,age_band) VALUES
 ('ddd30000-0000-4000-8000-000000000030','ddd30000-0000-4000-8000-000000000001','admin','admin','verified','adult'),
 ('ddd30000-0000-4000-8000-000000000040','ddd30000-0000-4000-8000-000000000001','admin','admin','pending_doc','adult');
INSERT INTO public."HomePreference" (home_id) VALUES ('ddd30000-0000-4000-8000-000000000040');
INSERT INTO public."HomeAuditLog" (home_id,actor_user_id,action,target_type,target_id,metadata)
 SELECT home_id,user_id,'OCCUPANCY_TEMPLATE_APPLIED','HomeOccupancy',id,
 '{"verification_status":"pending_doc"}' FROM public."HomeOccupancy"
 WHERE home_id='ddd30000-0000-4000-8000-000000000040';
INSERT INTO public."HomeOwnershipClaim" (home_id,claimant_user_id,state)
 VALUES ('ddd30000-0000-4000-8000-000000000040','ddd30000-0000-4000-8000-000000000001','submitted');
INSERT INTO public."Payment" (id,home_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee)
 VALUES ('ddd30000-0000-4000-8000-000000000050','ddd30000-0000-4000-8000-000000000050',
 'ddd30000-0000-4000-8000-000000000001','ddd30000-0000-4000-8000-000000000002',100,100,0,100);
INSERT INTO public."AddressCalendarRule" (scope_type,scope_key,kind,title,rrule,dtstart,created_by) VALUES
 ('home','ddd30000-0000-4000-8000-000000000040','garbage','Own private pickup','FREQ=WEEKLY;BYDAY=MO','2026-09-10','ddd30000-0000-4000-8000-000000000001'),
 ('home','DDD30000-0000-4000-8000-000000000050','garbage','Rollback pickup','FREQ=WEEKLY;BYDAY=TU','2026-09-10','ddd30000-0000-4000-8000-000000000001'),
 ('state','ZZ','other','State rule unchanged','FREQ=YEARLY','2026-09-10',null),
 ('city','ZZ:Synthetic','other','City rule unchanged','FREQ=YEARLY','2026-09-10',null),
 ('county','ZZ:Synthetic County','other','County rule unchanged','FREQ=YEARLY','2026-09-10',null);

CREATE FUNCTION pg_temp.assert_home_delete_denied(h uuid,u uuid,expected_code text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r jsonb; before_home jsonb; before_payments jsonb; before_rules jsonb;
BEGIN
 SELECT to_jsonb(t) INTO before_home FROM public."Home" t WHERE id=h;
 SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO before_payments FROM public."Payment" t WHERE home_id=h;
 SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO before_rules FROM public."AddressCalendarRule" t
 WHERE scope_type='home' AND public.home_calendar_scope_id(scope_key)=h;
 r := public.home_delete_eligibility(h,u);
 IF r->>'allowed' IS DISTINCT FROM 'false' OR r->>'deleted' IS DISTINCT FROM 'false'
   OR r->>'code' IS DISTINCT FROM expected_code THEN RAISE EXCEPTION 'Wrong eligibility denial: % expected %',r,expected_code; END IF;
 r := public.delete_home_authorized(h,u);
 IF r->>'allowed' IS DISTINCT FROM 'false' OR r->>'deleted' IS DISTINCT FROM 'false'
   OR r->>'code' IS DISTINCT FROM expected_code THEN RAISE EXCEPTION 'Wrong mutation denial: % expected %',r,expected_code; END IF;
 IF before_home IS DISTINCT FROM (SELECT to_jsonb(t) FROM public."Home" t WHERE id=h)
   OR before_payments IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public."Payment" t WHERE home_id=h)
   OR before_rules IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public."AddressCalendarRule" t
     WHERE scope_type='home' AND public.home_calendar_scope_id(scope_key)=h) THEN
   RAISE EXCEPTION 'Denied deletion changed Home, payments or rules';
 END IF;
END;
$$;

DO $$
DECLARE r record; source text;
BEGIN
 IF has_function_privilege('anon','public.home_delete_eligibility(uuid,uuid)','execute')
   OR has_function_privilege('authenticated','public.home_delete_eligibility(uuid,uuid)','execute')
   OR has_function_privilege('anon','public.delete_home_authorized(uuid,uuid)','execute')
   OR has_function_privilege('authenticated','public.delete_home_authorized(uuid,uuid)','execute')
   OR has_table_privilege('anon','public."Home"','delete')
   OR has_table_privilege('authenticated','public."Home"','delete') THEN
   RAISE EXCEPTION 'Untrusted caller retains Home deletion authority'; END IF;
 IF NOT has_function_privilege('service_role','public.delete_home_authorized(uuid,uuid)','execute') THEN
   RAISE EXCEPTION 'Trusted API lost deletion RPC'; END IF;
 IF EXISTS (SELECT FROM pg_policy WHERE polrelid='public."Home"'::regclass
   AND polname IN ('home_delete_owner','home_delete_authorized')) THEN RAISE EXCEPTION 'Legacy delete policy remains'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conname IN ('community_mail_home_delete_guard',
   'home_map_pin_home_delete_guard','vacation_hold_home_delete_guard','mail_delivery_intent_home_delete_guard')
   AND contype='f' AND NOT convalidated AND confdeltype='r') <> 4 THEN
   RAISE EXCEPTION 'Missing non-destructive attachment fences'; END IF;
 -- A new Home dependency needs an explicit review in the private-setup policy.
 source := pg_get_functiondef('public.home_delete_eligibility(uuid,uuid)'::regprocedure);
 FOR r IN SELECT DISTINCT c.conrelid::regclass::text relation FROM pg_constraint c
   WHERE c.contype='f' AND c.confrelid='public."Home"'::regclass LOOP
   IF r.relation <> '"HomePreference"' AND position(r.relation IN source)=0 THEN
     RAISE EXCEPTION 'Home dependency is absent from the explicit deletion policy: %',r.relation;
   END IF;
 END LOOP;
END $$;

SET LOCAL ROLE service_role;
DO $$
DECLARE u constant uuid := 'ddd30000-0000-4000-8000-000000000001';
 other_u constant uuid := 'ddd30000-0000-4000-8000-000000000002';
 h constant uuid := 'ddd30000-0000-4000-8000-000000000010';
 primary_h constant uuid := 'ddd30000-0000-4000-8000-000000000020';
 private_h constant uuid := 'ddd30000-0000-4000-8000-000000000040';
 v_status text; v_age public.home_age_band; p public.home_permission; r jsonb;
BEGIN
 IF public.home_delete_eligibility(h,u)->>'allowed' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'Legacy adult-compatible owner with no occupancy cannot delete'; END IF;
 IF public.home_delete_eligibility(primary_h,u)->>'allowed' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'Verified primary user owner with no occupancy cannot delete'; END IF;
 PERFORM pg_temp.assert_home_delete_denied(h,other_u,'DELETE_HOME_NOT_PRIMARY');
 PERFORM pg_temp.assert_home_delete_denied('ddd30000-0000-4000-8000-000000000999',u,'HOME_NOT_FOUND');
 PERFORM pg_temp.assert_home_delete_denied(h,null,'HOME_DELETE_ACCESS_DENIED');
 -- A verified co-owner and an editor may leave/transfer, never erase Home.
 UPDATE public."HomeOwner" SET is_primary_owner=false WHERE home_id=primary_h;
 PERFORM pg_temp.assert_home_delete_denied(primary_h,u,'DELETE_HOME_NOT_PRIMARY');
 UPDATE public."HomeOwner" SET is_primary_owner=true,owner_status='revoked' WHERE home_id=primary_h;
 PERFORM pg_temp.assert_home_delete_denied(primary_h,u,'HOME_DELETE_ACCESS_DENIED');
 UPDATE public."HomeOwner" SET owner_status='verified',subject_type='business' WHERE home_id=primary_h;
 PERFORM pg_temp.assert_home_delete_denied(primary_h,u,'DELETE_HOME_NOT_PRIMARY');
 UPDATE public."HomeOwner" SET subject_type='user' WHERE home_id=primary_h;
 -- A past revocation must not veto a subsequently verified primary owner.
 INSERT INTO public."HomeOwner" (home_id,subject_id,subject_type,owner_status,is_primary_owner)
 VALUES(primary_h,u,'user','revoked',false);
 IF public.home_delete_eligibility(primary_h,u)->>'allowed' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'Historical revoked ownership vetoed current verified primary ownership'; END IF;
 DELETE FROM public."HomeOwner" WHERE home_id=primary_h AND owner_status='revoked';
 -- Explicit revocation/dispute wins even when a stale legacy owner pointer and
 -- the shared read resolver still report ownership.
 INSERT INTO public."HomeOwner" (home_id,subject_id,subject_type,owner_status,is_primary_owner)
 VALUES(h,u,'user','revoked',true);
 PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_ACCESS_DENIED');
 UPDATE public."HomeOwner" SET owner_status='disputed' WHERE home_id=h;
 PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_ACCESS_DENIED');
 DELETE FROM public."HomeOwner" WHERE home_id=h;
 INSERT INTO public."HomePermissionOverride" (home_id,user_id,permission,allowed,created_by)
 SELECT 'ddd30000-0000-4000-8000-000000000030',u,permission,true,u
 FROM unnest(ARRAY['home.edit','security.manage']::public.home_permission[]) permission;
 PERFORM pg_temp.assert_home_delete_denied('ddd30000-0000-4000-8000-000000000030',u,'DELETE_HOME_NOT_PRIMARY');

 INSERT INTO public."HomeOccupancy" (home_id,user_id,role,role_base,is_active,verification_status,age_band)
 VALUES(h,u,'owner','owner',true,'verified','adult');
 FOREACH v_age IN ARRAY ARRAY['child','teen']::public.home_age_band[] LOOP
   UPDATE public."HomeOccupancy" SET age_band=v_age WHERE home_id=h;
   PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_ACCESS_DENIED');
 END LOOP;
 UPDATE public."HomeOccupancy" SET age_band=null WHERE home_id=h;
 IF public.home_delete_eligibility(h,u)->>'allowed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Null age compatibility lost'; END IF;
 FOREACH v_status IN ARRAY ARRAY['unverified','pending_doc','pending_postcard','provisional_bootstrap','revoked','moved_out'] LOOP
   UPDATE public."HomeOccupancy" SET verification_status=v_status WHERE home_id=h;
   -- Pending creator state may be private only while no established owner is present.
   INSERT INTO public."HomeOwner" (home_id,subject_id,subject_type,owner_status,is_primary_owner)
   VALUES(h,u,'user','verified',true);
   PERFORM pg_temp.assert_home_delete_denied(h,u,'DELETE_HOME_NOT_PRIMARY');
   DELETE FROM public."HomeOwner" WHERE home_id=h;
 END LOOP;
 UPDATE public."HomeOccupancy" SET verification_status='verified',is_active=false WHERE home_id=h;
 PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_ACCESS_DENIED');
 UPDATE public."HomeOccupancy" SET is_active=true,end_at=now() WHERE home_id=h;
 PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_ACCESS_DENIED');
 UPDATE public."HomeOccupancy" SET end_at=null,access_end_at=now() WHERE home_id=h;
 PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_ACCESS_DENIED');
 UPDATE public."HomeOccupancy" SET access_end_at=null,start_at=now()+interval '1 day' WHERE home_id=h;
 PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_ACCESS_DENIED');
 UPDATE public."HomeOccupancy" SET start_at=now()-interval '1 day',access_start_at=now()+interval '1 day' WHERE home_id=h;
 PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_ACCESS_DENIED');
 UPDATE public."HomeOccupancy" SET access_start_at=null WHERE home_id=h;
 FOREACH p IN ARRAY ARRAY['home.edit','security.manage']::public.home_permission[] LOOP
   INSERT INTO public."HomePermissionOverride" (home_id,user_id,permission,allowed,created_by) VALUES(h,u,p,false,u);
   PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_ACCESS_DENIED');
   DELETE FROM public."HomePermissionOverride" WHERE home_id=h;
 END LOOP;
 UPDATE public."Home" SET security_state='frozen_silent' WHERE id=h;
 PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_ACCESS_DENIED');
 UPDATE public."Home" SET security_state='normal' WHERE id=h;

 IF public.home_is_active_member(private_h,u) OR public.home_delete_eligibility(private_h,u)->>'allowed' <> 'true' THEN
   RAISE EXCEPTION 'Exact creator private setup is not separate from shared membership'; END IF;
 FOREACH v_age IN ARRAY ARRAY['child','teen']::public.home_age_band[] LOOP
   UPDATE public."HomeOccupancy" SET age_band=v_age WHERE home_id=private_h;
   PERFORM pg_temp.assert_home_delete_denied(private_h,u,'HOME_DELETE_ACCESS_DENIED');
 END LOOP;
 UPDATE public."HomeOccupancy" SET age_band='adult',verification_status='provisional_bootstrap' WHERE home_id=private_h;
 IF public.home_delete_eligibility(private_h,u)->>'allowed' <> 'true' THEN RAISE EXCEPTION 'Private bootstrap cleanup lost'; END IF;
 UPDATE public."HomeOccupancy" SET verified_at=now() WHERE home_id=private_h;
 PERFORM pg_temp.assert_home_delete_denied(private_h,u,'DELETE_HOME_NOT_PRIMARY');
 UPDATE public."HomeOccupancy" SET verified_at=null WHERE home_id=private_h;
 UPDATE public."HomeAuditLog" SET metadata='{"verification_status":"verified"}' WHERE home_id=private_h;
 PERFORM pg_temp.assert_home_delete_denied(private_h,u,'HOME_DELETE_ESTABLISHED_HOUSEHOLD');
 UPDATE public."HomeAuditLog" SET metadata='{"verification_status":"pending_doc"}' WHERE home_id=private_h;
 INSERT INTO public."HomeOccupancy" (home_id,user_id,role,is_active,verification_status)
 VALUES(private_h,other_u,'member',false,'moved_out');
 PERFORM pg_temp.assert_home_delete_denied(private_h,u,'DELETE_HOME_NOT_PRIMARY');
 DELETE FROM public."HomeOccupancy" WHERE home_id=private_h AND user_id=other_u;
 INSERT INTO public."HomeOwner" (home_id,subject_id,subject_type,owner_status)
 VALUES(private_h,other_u,'user','pending');
 PERFORM pg_temp.assert_home_delete_denied(private_h,u,'DELETE_HOME_NOT_PRIMARY');
 DELETE FROM public."HomeOwner" WHERE home_id=private_h AND subject_id=other_u;
 UPDATE public."Home" SET created_by_user_id=other_u WHERE id=private_h;
 PERFORM pg_temp.assert_home_delete_denied(private_h,u,'DELETE_HOME_NOT_PRIMARY');
 UPDATE public."Home" SET created_by_user_id=u WHERE id=private_h;
 UPDATE public."HomeAuditLog" SET actor_user_id=other_u WHERE home_id=private_h;
 PERFORM pg_temp.assert_home_delete_denied(private_h,u,'HOME_DELETE_ESTABLISHED_HOUSEHOLD');
 UPDATE public."HomeAuditLog" SET actor_user_id=u WHERE home_id=private_h;
 UPDATE public."AddressCalendarRule" SET created_by=other_u WHERE scope_type='home' AND scope_key=private_h::text;
 PERFORM pg_temp.assert_home_delete_denied(private_h,u,'HOME_DELETE_ESTABLISHED_HOUSEHOLD');
 UPDATE public."AddressCalendarRule" SET created_by=u WHERE scope_type='home' AND scope_key=private_h::text;
 INSERT INTO public."HomeTask" (home_id,created_by,title,task_type) VALUES(private_h,other_u,'Foreign household task','chore');
 PERFORM pg_temp.assert_home_delete_denied(private_h,u,'HOME_DELETE_ESTABLISHED_HOUSEHOLD');
 DELETE FROM public."HomeTask" WHERE home_id=private_h;
 FOREACH p IN ARRAY ARRAY['home.edit','security.manage']::public.home_permission[] LOOP
   INSERT INTO public."HomePermissionOverride" (home_id,user_id,permission,allowed,created_by) VALUES(private_h,u,p,false,u);
   PERFORM pg_temp.assert_home_delete_denied(private_h,u,'HOME_DELETE_ACCESS_DENIED');
   DELETE FROM public."HomePermissionOverride" WHERE home_id=private_h;
 END LOOP;
 r := public.delete_home_authorized(private_h,u);
 IF r <> '{"allowed":true,"code":"HOME_DELETED","deleted":true}'::jsonb
   OR EXISTS(SELECT FROM public."Home" WHERE id=private_h)
   OR EXISTS(SELECT FROM public."HomePreference" WHERE home_id=private_h)
   OR EXISTS(SELECT FROM public."AddressCalendarRule" WHERE scope_type='home' AND scope_key=private_h::text) THEN
   RAISE EXCEPTION 'Exact private cleanup failed: %',r; END IF;
 PERFORM pg_temp.assert_home_delete_denied(private_h,u,'HOME_NOT_FOUND');
 IF (SELECT count(*) FROM public."AddressCalendarRule" WHERE scope_key IN ('ZZ','ZZ:Synthetic','ZZ:Synthetic County')) <> 3 THEN
   RAISE EXCEPTION 'Non-Home rules were changed'; END IF;
END $$;
RESET ROLE;

-- Each formerly unbound Home UUID now accepts valid references and refuses a
-- new orphan; existing linked rows must be retired before Home deletion.
INSERT INTO public."Mail" (id,type,content,recipient_user_id)
 VALUES ('ddd30000-0000-4000-8000-000000000070','notice','Synthetic attachment fixture','ddd30000-0000-4000-8000-000000000001');
SET LOCAL ROLE service_role;
DO $$
DECLARE h constant uuid := 'ddd30000-0000-4000-8000-000000000010';
 u constant uuid := 'ddd30000-0000-4000-8000-000000000001';
 missing_h constant uuid := 'ddd30000-0000-4000-8000-000000000999'; target uuid;
BEGIN
 FOREACH target IN ARRAY ARRAY[h,missing_h] LOOP
   BEGIN
     INSERT INTO public."CommunityMailItem" (home_id,published_by,community_type,title)
     VALUES(target,u,'civic_notice','Synthetic notice');
     IF target=missing_h THEN RAISE EXCEPTION 'Community mail orphan admitted'; END IF;
     PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_LINKED_DATA');
     DELETE FROM public."CommunityMailItem" WHERE home_id=h;
   EXCEPTION WHEN foreign_key_violation THEN IF target=h THEN RAISE; END IF; END;
   BEGIN
     INSERT INTO public."HomeMapPin" (home_id,created_by,pin_type,title,lat,lng)
     VALUES(target,u,'notice','Synthetic pin',0,0);
     IF target=missing_h THEN RAISE EXCEPTION 'Map pin orphan admitted'; END IF;
     PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_LINKED_DATA');
     DELETE FROM public."HomeMapPin" WHERE home_id=h;
   EXCEPTION WHEN foreign_key_violation THEN IF target=h THEN RAISE; END IF; END;
   BEGIN
     INSERT INTO public."VacationHold" (home_id,user_id,start_date,end_date)
     VALUES(target,u,'2026-09-10','2026-09-11');
     IF target=missing_h THEN RAISE EXCEPTION 'Vacation hold orphan admitted'; END IF;
     PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_LINKED_DATA');
     DELETE FROM public."VacationHold" WHERE home_id=h;
   EXCEPTION WHEN foreign_key_violation THEN IF target=h THEN RAISE; END IF; END;
   BEGIN
     INSERT INTO public."MailDeliveryIntent" (intended_home_id,mail_id,sender_user_id,route_type)
     VALUES(target,'ddd30000-0000-4000-8000-000000000070',u,'invited_person_at_address');
     IF target=missing_h THEN RAISE EXCEPTION 'Mail intent orphan admitted'; END IF;
     PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_LINKED_DATA');
     DELETE FROM public."MailDeliveryIntent" WHERE intended_home_id=h;
   EXCEPTION WHEN foreign_key_violation THEN IF target=h THEN RAISE; END IF; END;
 END LOOP;
 BEGIN
   INSERT INTO public."AddressCalendarRule" (scope_type,scope_key,kind,title,rrule,dtstart)
   VALUES('home',missing_h::text,'garbage','Orphan pickup','FREQ=WEEKLY','2026-09-10');
   RAISE EXCEPTION 'Home pickup orphan admitted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
   UPDATE public."AddressCalendarRule" SET scope_type='home',scope_key='not-a-home'
   WHERE scope_type='state' AND scope_key='ZZ';
   RAISE EXCEPTION 'Home pickup malformed key admitted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 UPDATE public."AddressCalendarRule" SET title=title || ' verified' WHERE scope_type IN ('state','city','county')
   AND scope_key IN ('ZZ','ZZ:Synthetic','ZZ:Synthetic County');
 IF (SELECT count(*) FROM public."AddressCalendarRule" WHERE scope_key IN ('ZZ','ZZ:Synthetic','ZZ:Synthetic County')
   AND title LIKE '% verified') <> 3 THEN RAISE EXCEPTION 'Non-Home rule updates were restricted'; END IF;
END $$;
RESET ROLE;

-- A real late database failure after Payment unlink must roll all writes back.
CREATE FUNCTION pg_temp.reject_home_delete_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Synthetic final-delete failure' USING ERRCODE='23514'; END;
$$;
CREATE TRIGGER home_delete_fixture_failure BEFORE DELETE ON public."Home"
 FOR EACH ROW WHEN (OLD.id='ddd30000-0000-4000-8000-000000000050'::uuid)
 EXECUTE FUNCTION pg_temp.reject_home_delete_fixture();
SET LOCAL ROLE service_role;
DO $$
DECLARE h constant uuid := 'ddd30000-0000-4000-8000-000000000050';
 u constant uuid := 'ddd30000-0000-4000-8000-000000000001'; r jsonb; before_payment jsonb; before_rules jsonb;
BEGIN
 SELECT to_jsonb(t) INTO before_payment FROM public."Payment" t WHERE id=h;
 SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO before_rules FROM public."AddressCalendarRule" t WHERE scope_key=h::text;
 r:=public.delete_home_authorized(h,u);
 IF r->>'code' IS DISTINCT FROM 'HOME_DELETE_FAILED' OR r->>'deleted' IS DISTINCT FROM 'false'
   OR NOT EXISTS(SELECT FROM public."Home" WHERE id=h)
   OR before_payment IS DISTINCT FROM (SELECT to_jsonb(t) FROM public."Payment" t WHERE id=h)
   OR before_rules IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public."AddressCalendarRule" t WHERE scope_key=h::text) THEN
   RAISE EXCEPTION 'Failed deletion did not restore exact Payment and rules: %',r; END IF;
END $$;
RESET ROLE;
DROP TRIGGER home_delete_fixture_failure ON public."Home";
SET LOCAL ROLE service_role;
DO $$
DECLARE h constant uuid := 'ddd30000-0000-4000-8000-000000000050'; r jsonb;
BEGIN
 r:=public.delete_home_authorized(h,'ddd30000-0000-4000-8000-000000000001');
 IF r->>'deleted' IS DISTINCT FROM 'true' OR EXISTS(SELECT FROM public."Home" WHERE id=h)
   OR NOT EXISTS(SELECT FROM public."Payment" WHERE id=h AND home_id IS NULL)
   OR EXISTS(SELECT FROM public."AddressCalendarRule" WHERE scope_key=h::text) THEN RAISE EXCEPTION 'Atomic deletion failed: %',r; END IF;
END $$;
RESET ROLE;

-- Active bytes and deleted upload tombstones both survive a denied Home delete.
INSERT INTO public."File" (id,user_id,home_id,filename,original_filename,file_path,file_url,file_size,mime_type,file_extension,file_type,visibility,metadata)
 VALUES ('ddd30000-0000-4000-8000-000000000061','ddd30000-0000-4000-8000-000000000001',
 'ddd30000-0000-4000-8000-000000000060','synthetic.txt','synthetic.txt','private-synthetic','/synthetic',19,'text/plain','.txt','home_document','private',
 '{"storage_contract":"home_document_v1","upload_fingerprint":"synthetic"}');
INSERT INTO public."HomeDocument" (id,file_id,home_id,created_by,title,doc_type,visibility,details)
 VALUES ('ddd30000-0000-4000-8000-000000000061','ddd30000-0000-4000-8000-000000000061',
 'ddd30000-0000-4000-8000-000000000060','ddd30000-0000-4000-8000-000000000001','Storage fixture','receipt','members',
 '{"storage_contract":"home_document_v1","upload_fingerprint":"synthetic"}');
SET LOCAL ROLE service_role;
DO $$
DECLARE h constant uuid := 'ddd30000-0000-4000-8000-000000000060';
 u constant uuid := 'ddd30000-0000-4000-8000-000000000001'; before_file jsonb; before_document jsonb; before_quota jsonb;
BEGIN
 SELECT to_jsonb(t) INTO before_file FROM public."File" t WHERE home_id=h;
 SELECT to_jsonb(t) INTO before_document FROM public."HomeDocument" t WHERE home_id=h;
 SELECT to_jsonb(t) INTO before_quota FROM public."FileQuota" t WHERE user_id=u;
 PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_STORAGE_CLEANUP_REQUIRED');
 IF before_file IS DISTINCT FROM (SELECT to_jsonb(t) FROM public."File" t WHERE home_id=h)
   OR before_document IS DISTINCT FROM (SELECT to_jsonb(t) FROM public."HomeDocument" t WHERE home_id=h)
   OR before_quota IS DISTINCT FROM (SELECT to_jsonb(t) FROM public."FileQuota" t WHERE user_id=u) THEN
   RAISE EXCEPTION 'Denied Home deletion changed protected byte/quota records'; END IF;
 PERFORM public.delete_home_document_file(h,'ddd30000-0000-4000-8000-000000000061',u,'synthetic','members');
 PERFORM pg_temp.assert_home_delete_denied(h,u,'HOME_DELETE_STORAGE_CLEANUP_REQUIRED');
 IF NOT EXISTS(SELECT FROM public."File" WHERE home_id=h AND is_deleted AND metadata->>'storage_cleanup_pending'='true') THEN
   RAISE EXCEPTION 'Home deletion discarded the pending cleanup tombstone'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ddd30000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 BEGIN
   DELETE FROM public."Home" WHERE id='ddd30000-0000-4000-8000-000000000010';
   RAISE EXCEPTION 'Direct client Home DELETE was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.delete_home_authorized('ddd30000-0000-4000-8000-000000000010','ddd30000-0000-4000-8000-000000000001');
   RAISE EXCEPTION 'Client called trusted Home deletion';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: exact Home deletion, private provenance, storage retention and Payment rollback' AS result;
