-- Real transactional setup, durable outcomes and original-command fencing.
-- Every fixture is rolled back by the contract runner.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id,email) SELECT ('ddc24000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'home-create-'||n||'@example.invalid' FROM generate_series(1,3)n;
INSERT INTO public."User"(id,email,username,name,date_of_birth) SELECT id,email,
 'home_create_fixture_'||right(id::text,1),'Home creation fixture',
 CASE WHEN right(id::text,1)='3' THEN (current_date-interval '10 years')::date END
 FROM auth.users WHERE id::text LIKE 'ddc24000-0000-4000-8000-%';
INSERT INTO public."HomeAddress"(id,address_line1_norm,city_norm,state,postal_code,country,address_hash)
 SELECT ('ddc24000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Create fixture '||n,'Test','WA','98607','US',
 encode(sha256(convert_to('home-create-fixture-'||n,'UTF8')),'hex') FROM generate_series(101,105)n;
CREATE FUNCTION pg_temp.home_create_prepared(a uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('address',address_line1_norm,'address2',address_line2_norm,'city',city_norm,'state',state,
 'zipcode',postal_code,'country',country,'address_id',id,'address_hash',address_hash) FROM public."HomeAddress" WHERE id=a;
$$;
CREATE FUNCTION pg_temp.home_create_templates(owner boolean) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_object_agg(age,jsonb_build_object('role_base',CASE WHEN owner THEN 'restricted_member' ELSE 'member' END,
 'verification_status',CASE WHEN owner THEN 'pending_doc' ELSE 'provisional_bootstrap' END,'is_active',true,
 'can_manage_home',false,'can_manage_access',false,'can_manage_finance',false,'can_view_sensitive',false,
 'can_manage_tasks',NOT owner AND age<>'child')) FROM unnest(ARRAY['adult','teen','child'])age;
$$;
CREATE FUNCTION pg_temp.home_create_commit(actor uuid,request uuid,intent jsonb,address uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb; snapshot jsonb;
BEGIN
 r:=public.begin_home_create_command(actor,request,intent);
 SELECT to_jsonb(a) INTO snapshot FROM public."HomeAddress" a WHERE id=address;
 RETURN public.commit_home_create_command(actor,request,(r->>'worker_lease_id')::uuid,intent,
  pg_temp.home_create_prepared(address),snapshot,pg_temp.home_create_templates(intent->>'role'='owner'));
END $$;
SET LOCAL ROLE service_role;
DO $$
DECLARE
 actor uuid:='ddc24000-0000-4000-8000-000000000001'; other_actor uuid:='ddc24000-0000-4000-8000-000000000002';
 child uuid:='ddc24000-0000-4000-8000-000000000003'; v_addr uuid:='ddc24000-0000-4000-8000-000000000101';
 request uuid:='ddc24000-0000-4000-8000-000000000201'; q uuid; r jsonb; first jsonb; lease uuid; replacement uuid;
 intent jsonb; h uuid; home_count integer; snapshot jsonb; prepared jsonb;
BEGIN
 intent:='{"role":"owner","is_owner":true,"wifi_name":"Fixture WiFi","wifi_password":"local-fixture-only","access_secrets":[{"access_type":"door_code","label":"Fixture door","secret_value":"fixture-only","visibility":"members"}]}';
 r:=pg_temp.home_create_commit(actor,request,intent,v_addr); first:=r; h:=(r->>'home_id')::uuid;
 ASSERT r->>'state'='completed' AND r->>'committed_now'='true';
 ASSERT (SELECT owner_id IS NULL AND security_state='normal' AND home_status='active' AND amenities='{}'
   AND ownership_state='claim_pending' AND household_resolution_state='pending_single_claim' FROM public."Home" WHERE id=h);
 ASSERT (SELECT count(*)=1 FROM public."HomeOccupancy" WHERE home_id=h AND user_id=actor AND role_base='restricted_member'
   AND verification_status='pending_doc' AND verified_at IS NULL AND NOT can_manage_home AND NOT can_manage_access
   AND NOT can_manage_finance AND NOT can_view_sensitive AND NOT can_manage_tasks);
 ASSERT (SELECT count(*)=1 FROM public."HomeOwner" WHERE home_id=h AND owner_status='pending');
 ASSERT (SELECT count(*)=1 FROM public."HomeOwnershipClaim" WHERE home_id=h AND state='submitted'
   AND claim_phase_v2='evidence_submitted' AND identity_status='not_started');
 ASSERT (SELECT count(*)=1 FROM public."HomePreference" WHERE home_id=h);
 ASSERT (SELECT count(*)=2 FROM public."HomeAccessSecret" WHERE home_id=h AND secret_value='');
 ASSERT (SELECT count(*)=2 FROM public."HomeAccessSecretValue" WHERE access_secret_id=ANY(
   ARRAY(SELECT id FROM public."HomeAccessSecret" WHERE home_id=h)));
 ASSERT (SELECT count(*)=4 FROM public."HomeAuditLog" WHERE home_id=h);
 ASSERT public.home_record_context(h,actor)->>'private'='true';
 ASSERT public.home_effective_access(h,actor)->>'has_access'='false';
 ASSERT NOT r ? 'intent_hash' AND NOT r ? 'lease_id' AND NOT r::text LIKE '%local-fixture-only%';
 -- The response can disappear after commit: status, retry and Cancel all
 -- retain the same outcome without creating a second Home or cancelling it.
 r:=public.get_home_create_command(actor,request); ASSERT r->>'home_id'=h::text;
 r:=public.get_home_create_command(other_actor,request); ASSERT r->>'code'='HOME_CREATE_COMMAND_NOT_FOUND';
 r:=public.begin_home_create_command(actor,request,intent); ASSERT r->>'home_id'=h::text AND NOT r ? 'worker_lease_id';
 r:=public.cancel_home_create_command(actor,request); ASSERT r->>'state'='completed' AND r->>'home_id'=h::text;
 r:=public.begin_home_create_command(actor,request,'{"role":"household"}'); ASSERT r->>'code'='HOME_CREATE_INTENT_CONFLICT';
 q:=gen_random_uuid(); r:=pg_temp.home_create_commit(other_actor,q,'{"role":"household"}',v_addr);
 ASSERT r->>'state'='rejected' AND r->>'code'='HOME_ALREADY_EXISTS' AND r->>'conflict_home_id'=h::text;
 ASSERT (SELECT count(*)=1 FROM public."Home" WHERE address_id=v_addr);
 -- Invalid optional setup rejects atomically, including rollback of earlier
 -- Home, occupancy, preference, owner/claim, audit and valid-secret writes.
 v_addr:='ddc24000-0000-4000-8000-000000000102'; q:=gen_random_uuid();
 intent:='{"role":"owner","wifi_name":"Valid first WiFi","wifi_password":"fixture-only","access_secrets":[{"access_type":"door_code","label":"Invalid door","secret_value":""}]}';
 r:=pg_temp.home_create_commit(actor,q,intent,v_addr); ASSERT r->>'state'='rejected' AND r->>'code'='HOME_SECRET_INVALID';
 ASSERT (SELECT count(*)=0 FROM public."Home" WHERE address_id=v_addr);
 ASSERT (SELECT count(*)=1 FROM public."HomeOccupancy" WHERE user_id=actor);
 ASSERT (SELECT count(*)=1 FROM public."HomeOwnershipClaim" WHERE claimant_user_id=actor);
 ASSERT (SELECT count(*)=2 FROM public."HomeAccessSecret" WHERE created_by=actor);
 -- Child DOB survives creation and cannot gain task/access administration.
 q:=gen_random_uuid(); r:=pg_temp.home_create_commit(child,q,'{"role":"household"}',v_addr);
 ASSERT r->>'state'='completed';
 ASSERT (SELECT age_band='child' AND NOT can_manage_tasks AND NOT can_manage_access AND verified_at IS NULL
   FROM public."HomeOccupancy" WHERE home_id=(r->>'home_id')::uuid AND user_id=child);
 -- Cancellation before arrival and after reservation both fence real commits.
 v_addr:='ddc24000-0000-4000-8000-000000000103'; intent:='{"role":"household"}'; q:=gen_random_uuid();
 r:=public.cancel_home_create_command(actor,q); r:=public.begin_home_create_command(actor,q,intent);
 ASSERT r->>'state'='cancelled' AND NOT r ? 'worker_lease_id';
 q:=gen_random_uuid(); r:=public.begin_home_create_command(actor,q,intent); lease:=(r->>'worker_lease_id')::uuid;
 r:=public.cancel_home_create_command(actor,q);
 r:=public.commit_home_create_command(actor,q,lease,intent,'{}','{}','{}'); ASSERT r->>'state'='cancelled';
 ASSERT (SELECT count(*)=0 FROM public."Home" WHERE address_id=v_addr);
 -- Expired worker cannot commit or overwrite a replacement's decision.
 q:=gen_random_uuid(); r:=public.begin_home_create_command(actor,q,intent); lease:=(r->>'worker_lease_id')::uuid;
 UPDATE public."HomeCreateCommand" SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE actor_user_id=actor AND request_id=q;
 r:=public.begin_home_create_command(actor,q,intent); replacement:=(r->>'worker_lease_id')::uuid; ASSERT replacement<>lease;
 r:=public.commit_home_create_command(actor,q,lease,intent,'{}','{}','{}'); ASSERT r->>'worker_retired'='true';
 r:=public.finish_home_create_attempt(actor,q,lease,'ADDRESS_VALIDATION_REQUIRED',422); ASSERT r->>'state'='pending';
 SELECT to_jsonb(a) INTO snapshot FROM public."HomeAddress" a WHERE id=v_addr;
 prepared:=pg_temp.home_create_prepared(v_addr);
 UPDATE public."HomeAddress" SET geocode_lat=12 WHERE id=v_addr;
 r:=public.commit_home_create_command(actor,q,replacement,intent,prepared,snapshot,pg_temp.home_create_templates(false));
 ASSERT r->>'state'='pending' AND r->>'code'='HOME_CREATE_ADDRESS_CHANGED';
 ASSERT (SELECT count(*)=0 FROM public."Home" WHERE address_id=v_addr);
 r:=pg_temp.home_create_commit(actor,q,intent,v_addr); ASSERT r->>'state'='completed';
 -- Retained outcomes outlive deletion. They do not grant current authority.
 DELETE FROM public."Home" WHERE id=h;
 r:=public.begin_home_create_command(actor,request,first-'ok'); ASSERT r->>'code'='HOME_CREATE_INTENT_CONFLICT';
 r:=public.get_home_create_command(actor,request); ASSERT r->>'state'='completed' AND r->>'home_id'=h::text;
 ASSERT (SELECT count(*)=0 FROM public."Home" WHERE id=h);
 ASSERT NOT has_table_privilege('authenticated','public."HomeCreateCommand"','SELECT');
 ASSERT NOT has_function_privilege('authenticated','public.commit_home_create_command(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb)','EXECUTE');
END $$;
RESET ROLE;
-- The existing building tools create private unit setup, not inherited ownership.
INSERT INTO public."HomeAddress"(id,address_line1_norm,address_line2_norm,city_norm,state,postal_code,country,address_hash)
 SELECT ('ddc24000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Unit contract road',CASE WHEN n>301 THEN 'Apt '||n END,
 'Test','WA','98607','US',encode(sha256(convert_to('unit-create-fixture-'||n,'UTF8')),'hex') FROM generate_series(301,308)n;
INSERT INTO public."Home"(id,address,address_id,city,state,zipcode,home_type)
 VALUES('ddc24000-0000-4000-8000-000000000310','Unit contract road','ddc24000-0000-4000-8000-000000000301','Test','WA','98607','multi_unit');
INSERT INTO public."HomeAuthority"(id,home_id,subject_type,subject_id,role,status)
 VALUES('ddc24000-0000-4000-8000-000000000320','ddc24000-0000-4000-8000-000000000310','user','ddc24000-0000-4000-8000-000000000001','owner','verified');
CREATE FUNCTION pg_temp.unit_create_commit(actor uuid,request uuid,intent jsonb,address uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb; snapshot jsonb; templates jsonb;
BEGIN
 r:=public.begin_home_create_command(actor,request,intent); IF NOT r ? 'worker_lease_id' THEN RETURN r; END IF;
 SELECT to_jsonb(a) INTO snapshot FROM public."HomeAddress" a WHERE id=address;
 SELECT jsonb_object_agg(key,value||'{"role_base":"manager"}'::jsonb) INTO templates FROM jsonb_each(pg_temp.home_create_templates(false));
 RETURN public.commit_home_create_command(actor,request,(r->>'worker_lease_id')::uuid,intent,
  pg_temp.home_create_prepared(address)||'{"home_type":"apartment"}'::jsonb,snapshot,templates);
END $$;
SET LOCAL ROLE service_role;
DO $$ DECLARE actor uuid:='ddc24000-0000-4000-8000-000000000001'; other_actor uuid:='ddc24000-0000-4000-8000-000000000002';
 parent uuid:='ddc24000-0000-4000-8000-000000000310'; authority uuid:='ddc24000-0000-4000-8000-000000000320';
 addr uuid:='ddc24000-0000-4000-8000-000000000302'; q uuid:=gen_random_uuid(); r jsonb; first jsonb;
 intent jsonb:=jsonb_build_object('role','property_manager','bulk_parent_home_id',parent,'bulk_intent_hash',repeat('a',64));
BEGIN
 r:=pg_temp.unit_create_commit(other_actor,gen_random_uuid(),intent,addr);
 ASSERT r->>'state'='rejected' AND r->>'code'='HOME_CREATE_PARENT_UNAVAILABLE';
 ASSERT NOT EXISTS(SELECT FROM public."Home" WHERE address_id=addr);
 UPDATE public."Home" SET security_state='frozen' WHERE id=parent;
 r:=pg_temp.unit_create_commit(actor,gen_random_uuid(),intent,addr); ASSERT r->>'code'='HOME_CREATE_PARENT_UNAVAILABLE';
 UPDATE public."Home" SET security_state='normal',home_type='house' WHERE id=parent;
 r:=pg_temp.unit_create_commit(actor,gen_random_uuid(),intent,addr); ASSERT r->>'code'='HOME_CREATE_PARENT_UNAVAILABLE';
 UPDATE public."Home" SET home_type='multi_unit' WHERE id=parent;
 UPDATE public."HomeAuthority" SET status='revoked' WHERE id=authority;
 r:=pg_temp.unit_create_commit(actor,gen_random_uuid(),intent,addr); ASSERT r->>'code'='HOME_CREATE_PARENT_UNAVAILABLE';
 UPDATE public."HomeAuthority" SET status='verified' WHERE id=authority;
 r:=pg_temp.unit_create_commit(actor,gen_random_uuid(),intent||'{"role":"owner"}',addr); ASSERT r->>'code'='HOME_CREATE_PARENT_UNAVAILABLE';
 r:=pg_temp.unit_create_commit(actor,q,intent,addr); first:=r; ASSERT r->>'state'='completed';
 ASSERT (SELECT parent_home_id=parent AND owner_id IS NULL AND home_type='apartment' FROM public."Home" WHERE id=(r->>'home_id')::uuid);
 ASSERT (SELECT role_base='manager' AND verification_status='provisional_bootstrap' AND verified_at IS NULL
   AND NOT can_manage_access AND NOT can_manage_home AND NOT can_view_sensitive FROM public."HomeOccupancy" WHERE home_id=(r->>'home_id')::uuid AND user_id=actor);
 ASSERT NOT EXISTS(SELECT FROM public."HomeAuthority" WHERE home_id=(r->>'home_id')::uuid);
 ASSERT NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=(r->>'home_id')::uuid);
 r:=pg_temp.unit_create_commit(actor,q,intent,addr); ASSERT r->>'home_id'=first->>'home_id';
 r:=public.begin_home_create_command(actor,q,intent||jsonb_build_object('bulk_intent_hash',repeat('b',64))); ASSERT r->>'code'='HOME_CREATE_INTENT_CONFLICT';
 ASSERT (SELECT count(*)=1 FROM public."Home" WHERE address_id=addr);
 -- Business access is current seat/binding or current legacy team proof.
 UPDATE public."HomeAuthority" SET status='revoked' WHERE id=authority;
 INSERT INTO public."HomeAuthority"(home_id,subject_type,subject_id,role,status) VALUES(parent,'business',other_actor,'manager','verified');
 INSERT INTO public."BusinessSeat"(id,business_user_id,display_name,is_active) VALUES('ddc24000-0000-4000-8000-000000000330',other_actor,'Unit contract seat',true);
 INSERT INTO public."SeatBinding"(seat_id,user_id,binding_method) VALUES('ddc24000-0000-4000-8000-000000000330',actor,'invite_accept');
 addr:='ddc24000-0000-4000-8000-000000000303';r:=pg_temp.unit_create_commit(actor,gen_random_uuid(),intent,addr);ASSERT r->>'state'='completed';
 DELETE FROM public."SeatBinding" WHERE seat_id='ddc24000-0000-4000-8000-000000000330';
 addr:='ddc24000-0000-4000-8000-000000000304';r:=pg_temp.unit_create_commit(actor,gen_random_uuid(),intent,addr);ASSERT r->>'code'='HOME_CREATE_PARENT_UNAVAILABLE';
 INSERT INTO public."BusinessTeam"(business_user_id,user_id,role_base,is_active) VALUES(other_actor,actor,'admin',true);
 r:=pg_temp.unit_create_commit(actor,gen_random_uuid(),intent,addr);ASSERT r->>'state'='completed';
 UPDATE public."BusinessTeam" SET is_active=false WHERE business_user_id=other_actor AND user_id=actor;
 addr:='ddc24000-0000-4000-8000-000000000305';r:=pg_temp.unit_create_commit(actor,gen_random_uuid(),intent,addr);ASSERT r->>'code'='HOME_CREATE_PARENT_UNAVAILABLE';
 ASSERT NOT EXISTS(SELECT FROM public."Home" WHERE address_id=addr);
 RAISE NOTICE 'Existing Home creation and current-parent unit setup contracts passed';
END $$;
RESET ROLE;
ROLLBACK;
