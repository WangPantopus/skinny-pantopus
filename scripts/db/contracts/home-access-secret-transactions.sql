-- Exact Home secret storage, independent type-read/write permissions, private
-- setup provenance and rollback. No role defaults or provider calls.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE secret_reference_before AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows
  FROM public."HomeRolePermission" r;
INSERT INTO auth.users(id,email) SELECT ('ddc50000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'home-secret-'||n||'@example.invalid' FROM generate_series(1,8) n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'home_secret_'||right(id::text,1),'Secret fixture'
  FROM auth.users WHERE id::text LIKE 'ddc50000-0000-4000-8000-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode) VALUES
 ('ddc50000-0000-4000-8000-000000000100','ddc50000-0000-4000-8000-000000000001','ddc50000-0000-4000-8000-000000000001','100 Secret Test','Test','WA','98607'),
 ('ddc50000-0000-4000-8000-000000000200',null,'ddc50000-0000-4000-8000-000000000006','200 Secret Test','Test','WA','98607');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status)
 SELECT 'ddc50000-0000-4000-8000-000000000100',('ddc50000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 role,role::public.home_role_base,age::public.home_age_band,'verified'
 FROM (VALUES(1,'owner','adult'),(2,'member','adult'),(3,'member','adult'),(4,'admin','adult'),
  (5,'owner','child'),(8,'admin','adult')) f(n,role,age);
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES
 ('ddc50000-0000-4000-8000-000000000200','ddc50000-0000-4000-8000-000000000006','admin','admin','adult','pending_doc');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status) VALUES
 ('ddc50000-0000-4000-8000-000000000200','ddc50000-0000-4000-8000-000000000006','pending');
INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,state) VALUES
 ('ddc50000-0000-4000-8000-000000000201','ddc50000-0000-4000-8000-000000000200','ddc50000-0000-4000-8000-000000000006','submitted');
INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
 SELECT 'ddc50000-0000-4000-8000-000000000100',('ddc50000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 permission::public.home_permission,allowed,'ddc50000-0000-4000-8000-000000000001'
 FROM (VALUES(2,'access.view_wifi',true),(2,'sensitive.view',false),(3,'access.view_codes',true),(3,'access.view_wifi',false),
  (4,'access.manage',true),(4,'access.view_wifi',false),(4,'access.view_codes',false),(4,'sensitive.view',false),
  (8,'members.manage',true),(8,'access.manage',false)) f(n,permission,allowed);
CREATE FUNCTION pg_temp.expect_secret(r jsonb,c text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF r->>'code' IS DISTINCT FROM c OR r->>'ok' IS DISTINCT FROM 'false' THEN
   RAISE EXCEPTION 'Expected secret denial %, got %',c,r; END IF;
END $$;
CREATE TEMP TABLE secret_ids(label text,id uuid);
GRANT ALL ON secret_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE h uuid:='ddc50000-0000-4000-8000-000000000100'; o uuid:='ddc50000-0000-4000-8000-000000000001';
 wifi uuid:='ddc50000-0000-4000-8000-000000000002'; codes uuid:='ddc50000-0000-4000-8000-000000000003';
 writer uuid:='ddc50000-0000-4000-8000-000000000004'; child_id uuid:='ddc50000-0000-4000-8000-000000000005';
 member_manager uuid:='ddc50000-0000-4000-8000-000000000008'; outsider uuid:='ddc50000-0000-4000-8000-000000000007';
 r jsonb; rows jsonb; spec jsonb; secret_id uuid; before_meta jsonb; before_value jsonb; state text;
BEGIN
 FOREACH spec IN ARRAY ARRAY[
  '{"access_type":"wifi","label":"WiFi","secret_value":"fixture-wifi-original","visibility":"members"}',
  '{"access_type":"door_code","label":"Door","secret_value":"fixture-door","visibility":"members"}',
  '{"access_type":"wifi","label":"Sensitive","secret_value":"fixture-sensitive","visibility":"sensitive"}',
  '{"access_type":"door_code","label":"Manager","secret_value":"fixture-manager","visibility":"managers"}'
 ]::jsonb[] LOOP
  r:=public.mutate_home_access_secret(h,o,null,'create',spec);
  IF r->>'ok'<>'true' OR r->'secret'->>'secret_value'<>spec->>'secret_value' THEN RAISE EXCEPTION 'Secret create/readback failed'; END IF;
  INSERT INTO secret_ids VALUES(spec->>'label',(r->'secret'->>'id')::uuid);
 END LOOP;
 SELECT id INTO secret_id FROM secret_ids WHERE label='WiFi';
 IF EXISTS(SELECT FROM public."HomeAccessSecret" WHERE home_id=h AND secret_value<>'') THEN RAISE EXCEPTION 'Plaintext persisted in metadata'; END IF;
 rows:=public.get_home_access_secrets(h,wifi)->'secrets';
 IF jsonb_array_length(rows)<>1 OR rows->0->>'secret_value'<>'fixture-wifi-original' THEN RAISE EXCEPTION 'WiFi viewer read type/sensitive boundary failed'; END IF;
 rows:=public.get_home_access_secrets(h,codes)->'secrets';
 IF jsonb_array_length(rows)<>1 OR rows->0->>'label'<>'Door' THEN RAISE EXCEPTION 'Code viewer read type/manager boundary failed'; END IF;
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,writer),'HOME_SECRET_ACCESS_DENIED');
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,child_id),'HOME_SECRET_ACCESS_DENIED');
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,outsider),'HOME_SECRET_ACCESS_DENIED');
 PERFORM pg_temp.expect_secret(public.mutate_home_access_secret(h,member_manager,secret_id,'update','{"notes":"blocked"}'),'HOME_SECRET_WRITE_DENIED');
 PERFORM pg_temp.expect_secret(public.mutate_home_access_secret(h,wifi,secret_id,'delete'),'HOME_SECRET_WRITE_DENIED');
 PERFORM pg_temp.expect_secret(public.mutate_home_access_secret(h,child_id,secret_id,'update','{"secret_value":"blocked"}'),'HOME_SECRET_WRITE_DENIED');
 r:=public.mutate_home_access_secret(h,writer,secret_id,'update','{"notes":"Blind metadata update"}');
 IF r->>'ok'<>'true' OR r->'secret'->>'secret_value'<>'' OR r->'secret'->>'has_secret'<>'true' THEN RAISE EXCEPTION 'Mutation permission disclosed unreadable value'; END IF;
 IF (SELECT secret_value FROM public."HomeAccessSecretValue" WHERE access_secret_id=secret_id)<>'fixture-wifi-original' THEN RAISE EXCEPTION 'Omitted value rotated password'; END IF;
 r:=public.mutate_home_access_secret(h,o,secret_id,'update','{"secret_value":"fixture-wifi-rotated"}');
 IF r->'secret'->>'secret_value'<>'fixture-wifi-rotated' THEN RAISE EXCEPTION 'Rotation failed'; END IF;
 FOREACH spec IN ARRAY ARRAY['{"secret_value":""}','{"secret_value":null}','{"secret_value":"EMPTY"}','{"secret_value":5}',
   '{"created_by":"foreign"}','{"access_type":"unknown"}','{"visibility":"unknown"}']::jsonb[] LOOP
  PERFORM pg_temp.expect_secret(public.mutate_home_access_secret(h,o,secret_id,'update',spec),'HOME_SECRET_INVALID');
 END LOOP;
 PERFORM pg_temp.expect_secret(public.mutate_home_access_secret(h,writer,(SELECT id FROM secret_ids WHERE label='Sensitive'),'delete'),'HOME_SECRET_WRITE_DENIED');
 PERFORM pg_temp.expect_secret(public.mutate_home_access_secret(h,o,'ddc50000-0000-4000-8000-000000000999','delete'),'HOME_SECRET_NOT_FOUND');
 BEGIN
  PERFORM public.mutate_home_access_secret(h,o,null,'create','{"access_type":"wifi","label":"WiFi","secret_value":"duplicate"}');
  RAISE EXCEPTION 'Duplicate label succeeded';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 IF (SELECT count(*) FROM public."HomeAccessSecret" WHERE home_id=h)<>4 THEN RAISE EXCEPTION 'Duplicate left metadata'; END IF;
 FOREACH state IN ARRAY ARRAY['pending_doc','revoked','suspended'] LOOP
  UPDATE public."HomeOccupancy" SET verification_status=state WHERE home_id=h AND user_id=o;
  PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,o),'HOME_SECRET_ACCESS_DENIED');
 END LOOP;
 UPDATE public."HomeOccupancy" SET verification_status='verified',access_end_at=now() WHERE home_id=h AND user_id=o;
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,o),'HOME_SECRET_ACCESS_DENIED');
 UPDATE public."HomeOccupancy" SET access_end_at=null WHERE home_id=h AND user_id=o;
 UPDATE public."Home" SET security_state='frozen' WHERE id=h;
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,o),'HOME_SECRET_ACCESS_DENIED');
 UPDATE public."Home" SET security_state='normal' WHERE id=h;
END $$;
RESET ROLE;

-- Changing type cannot turn an unread value into readable preserved bytes.
DO $$ DECLARE h uuid:='ddc50000-0000-4000-8000-000000000100';
 o uuid:='ddc50000-0000-4000-8000-000000000001'; writer uuid:='ddc50000-0000-4000-8000-000000000004';
 sid uuid; old_type text; new_type text; r jsonb; before_meta jsonb; before_value jsonb; before_audit jsonb;
BEGIN
 FOREACH old_type IN ARRAY ARRAY['door_code','wifi'] LOOP
  new_type:=CASE WHEN old_type='wifi' THEN 'door_code' ELSE 'wifi' END;
  UPDATE public."HomePermissionOverride" SET allowed=(permission=CASE WHEN new_type='wifi'
    THEN 'access.view_wifi' ELSE 'access.view_codes' END::public.home_permission)
    WHERE home_id=h AND user_id=writer AND permission IN ('access.view_wifi','access.view_codes');
  r:=public.mutate_home_access_secret(h,o,null,'create',jsonb_build_object('access_type',old_type,
    'label','Type boundary '||old_type,'secret_value','fixture-hidden-'||old_type));
  sid:=(r->'secret'->>'id')::uuid;
  SELECT to_jsonb(s) INTO before_meta FROM public."HomeAccessSecret" s WHERE id=sid;
  SELECT to_jsonb(v) INTO before_value FROM public."HomeAccessSecretValue" v WHERE access_secret_id=sid;
  SELECT jsonb_agg(to_jsonb(a) ORDER BY id) INTO before_audit FROM public."HomeAuditLog" a WHERE home_id=h;
  PERFORM pg_temp.expect_secret(public.mutate_home_access_secret(h,writer,sid,'update',
    jsonb_build_object('access_type',new_type)),'HOME_SECRET_WRITE_DENIED');
  IF (SELECT to_jsonb(s) FROM public."HomeAccessSecret" s WHERE id=sid) IS DISTINCT FROM before_meta
    OR (SELECT to_jsonb(v) FROM public."HomeAccessSecretValue" v WHERE access_secret_id=sid) IS DISTINCT FROM before_value
    OR (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public."HomeAuditLog" a WHERE home_id=h) IS DISTINCT FROM before_audit THEN
    RAISE EXCEPTION 'Denied type relabel left metadata, value or audit writes'; END IF;
  r:=public.mutate_home_access_secret(h,writer,sid,'update',jsonb_build_object('access_type',new_type,
    'secret_value','fixture-replacement-'||new_type));
  IF r->>'ok' IS DISTINCT FROM 'true' OR r->'secret'->>'secret_value' IS DISTINCT FROM 'fixture-replacement-'||new_type THEN
    RAISE EXCEPTION 'Explicit blind replacement failed'; END IF;
  r:=public.mutate_home_access_secret(h,o,sid,'update',jsonb_build_object('access_type',old_type));
  IF r->>'ok' IS DISTINCT FROM 'true' OR r->'secret'->>'secret_value' IS DISTINCT FROM 'fixture-replacement-'||new_type THEN
    RAISE EXCEPTION 'Authorized type relabel did not preserve value'; END IF;
  PERFORM public.mutate_home_access_secret(h,o,sid,'delete');
 END LOOP;
 UPDATE public."HomePermissionOverride" SET allowed=false
   WHERE home_id=h AND user_id=writer AND permission IN ('access.view_wifi','access.view_codes');
END $$;

-- A downstream failure rolls back metadata, value and audit together.
CREATE FUNCTION pg_temp.fail_secret_value() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'Synthetic secret-value failure' USING ERRCODE='P0995'; END $$;
CREATE TRIGGER secret_value_contract_failure BEFORE INSERT OR UPDATE ON public."HomeAccessSecretValue"
 FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_secret_value();
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:='ddc50000-0000-4000-8000-000000000100'; o uuid:='ddc50000-0000-4000-8000-000000000001';
 action text; sid uuid; before_rows jsonb; before_values jsonb; before_audit jsonb;
BEGIN
 SELECT jsonb_agg(to_jsonb(s) ORDER BY id) INTO before_rows FROM public."HomeAccessSecret" s WHERE home_id=h;
 SELECT jsonb_agg(to_jsonb(v) ORDER BY access_secret_id) INTO before_values FROM public."HomeAccessSecretValue" v JOIN secret_ids i ON i.id=v.access_secret_id;
 SELECT jsonb_agg(to_jsonb(a) ORDER BY id) INTO before_audit FROM public."HomeAuditLog" a WHERE home_id=h;
 FOREACH action IN ARRAY ARRAY['create','update'] LOOP
  sid:=CASE WHEN action='update' THEN (SELECT id FROM secret_ids WHERE label='WiFi') ELSE null END;
  BEGIN
   PERFORM public.mutate_home_access_secret(h,o,sid,action,'{"access_type":"wifi","label":"Rollback","secret_value":"fixture-failure"}');
   RAISE EXCEPTION 'Injected value failure did not occur';
  EXCEPTION WHEN SQLSTATE 'P0995' THEN NULL; END;
  IF (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public."HomeAccessSecret" s WHERE home_id=h) IS DISTINCT FROM before_rows
   OR (SELECT jsonb_agg(to_jsonb(v) ORDER BY access_secret_id) FROM public."HomeAccessSecretValue" v JOIN secret_ids i ON i.id=v.access_secret_id) IS DISTINCT FROM before_values
   OR (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public."HomeAuditLog" a WHERE home_id=h) IS DISTINCT FROM before_audit THEN
   RAISE EXCEPTION 'Secret failure left partial writes'; END IF;
 END LOOP;
END $$;
RESET ROLE;
DROP TRIGGER secret_value_contract_failure ON public."HomeAccessSecretValue";

CREATE TRIGGER secret_audit_contract_failure BEFORE INSERT ON public."HomeAuditLog"
 FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_secret_value();
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:='ddc50000-0000-4000-8000-000000000100'; o uuid:='ddc50000-0000-4000-8000-000000000001';
 action text; sid uuid; before_rows jsonb; before_values jsonb; before_audit jsonb;
BEGIN
 SELECT jsonb_agg(to_jsonb(s) ORDER BY id) INTO before_rows FROM public."HomeAccessSecret" s WHERE home_id=h;
 SELECT jsonb_agg(to_jsonb(v) ORDER BY access_secret_id) INTO before_values FROM public."HomeAccessSecretValue" v JOIN secret_ids i ON i.id=v.access_secret_id;
 SELECT jsonb_agg(to_jsonb(a) ORDER BY id) INTO before_audit FROM public."HomeAuditLog" a WHERE home_id=h;
 FOREACH action IN ARRAY ARRAY['create','update','delete'] LOOP
  sid:=CASE WHEN action<>'create' THEN (SELECT id FROM secret_ids WHERE label='WiFi') ELSE null END;
  BEGIN
   PERFORM public.mutate_home_access_secret(h,o,sid,action,'{"access_type":"wifi","label":"Rollback audit","secret_value":"fixture-audit-failure"}');
   RAISE EXCEPTION 'Injected audit failure did not occur';
  EXCEPTION WHEN SQLSTATE 'P0995' THEN NULL; END;
  IF (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public."HomeAccessSecret" s WHERE home_id=h) IS DISTINCT FROM before_rows
   OR (SELECT jsonb_agg(to_jsonb(v) ORDER BY access_secret_id) FROM public."HomeAccessSecretValue" v JOIN secret_ids i ON i.id=v.access_secret_id) IS DISTINCT FROM before_values
   OR (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public."HomeAuditLog" a WHERE home_id=h) IS DISTINCT FROM before_audit THEN
   RAISE EXCEPTION 'Audit failure left partial secret writes'; END IF;
 END LOOP;
END $$;
RESET ROLE;
DROP TRIGGER secret_audit_contract_failure ON public."HomeAuditLog";

SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:='ddc50000-0000-4000-8000-000000000200'; u uuid:='ddc50000-0000-4000-8000-000000000006';
 outsider uuid:='ddc50000-0000-4000-8000-000000000007'; r jsonb; sid uuid; occ uuid; state text;
BEGIN
 SELECT id INTO occ FROM public."HomeOccupancy" WHERE home_id=h AND user_id=u;
 r:=public.mutate_home_access_secret(h,u,null,'bootstrap_wifi','{"access_type":"wifi","label":"Private WiFi","secret_value":"fixture-private"}');
 IF r->>'ok'<>'true' OR r->'secret'->>'secret_value'<>'fixture-private' THEN RAISE EXCEPTION 'Private WiFi bootstrap failed'; END IF;
 sid:=(r->'secret'->>'id')::uuid;
 PERFORM pg_temp.expect_secret(public.mutate_home_access_secret('ddc50000-0000-4000-8000-000000000100',
   'ddc50000-0000-4000-8000-000000000001',sid,'delete'),'HOME_SECRET_NOT_FOUND');
 IF public.home_is_active_member(h,u) OR public.home_has_permission(h,'access.manage',u) THEN RAISE EXCEPTION 'Private secret granted shared authority'; END IF;
 IF public.home_delete_eligibility(h,u)->>'allowed'<>'true' THEN RAISE EXCEPTION 'Own secret audit broke private Home cleanup'; END IF;
 IF public.get_home_access_secrets(h,u)->'secrets'->0->>'secret_value'<>'fixture-private' THEN RAISE EXCEPTION 'Private creator cannot read own WiFi'; END IF;
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,outsider),'HOME_SECRET_ACCESS_DENIED');
 PERFORM pg_temp.expect_secret(public.mutate_home_access_secret(h,u,sid,'update','{"visibility":"sensitive"}'),'HOME_SECRET_WRITE_DENIED');
 INSERT INTO public."HomeVerificationEvidence"(claim_id,evidence_type,storage_ref)
  VALUES('ddc50000-0000-4000-8000-000000000201','deed','secret-fixture-own-proof');
 INSERT INTO public."File"(home_id,user_id,filename,original_filename,file_path,file_url,file_size,mime_type,file_extension,file_type)
  VALUES(h,u,'proof.txt','proof.txt','secret-fixture-own-proof','/synthetic-proof',1,'text/plain','.txt','home_document');
 IF public.get_home_access_secrets(h,u)->'secrets'->0->>'secret_value'<>'fixture-private' THEN RAISE EXCEPTION 'Own pending proof blocked own WiFi'; END IF;
 IF public.home_delete_eligibility(h,u)->>'code'<>'HOME_DELETE_STORAGE_CLEANUP_REQUIRED' THEN RAISE EXCEPTION 'Private read bypassed proof storage retention'; END IF;
 UPDATE public."File" SET is_deleted=true,deleted_at=now() WHERE home_id=h;
 IF public.get_home_access_secrets(h,u)->>'ok'<>'true' THEN RAISE EXCEPTION 'Own proof tombstone blocked WiFi'; END IF;
 UPDATE public."File" SET user_id=outsider WHERE home_id=h;
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,u),'HOME_SECRET_ACCESS_DENIED');
 UPDATE public."File" SET user_id=u WHERE home_id=h;
 UPDATE public."HomeOwnershipClaim" SET reviewed_at=now() WHERE home_id=h;
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,u),'HOME_SECRET_ACCESS_DENIED');
 UPDATE public."HomeOwnershipClaim" SET reviewed_at=null WHERE home_id=h;
 UPDATE public."HomeOccupancy" SET verified_at=now() WHERE id=occ;
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,u),'HOME_SECRET_ACCESS_DENIED');
 UPDATE public."HomeOccupancy" SET verified_at=null WHERE id=occ;
 INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
  VALUES(h,u,'OCCUPANCY_TEMPLATE_APPLIED','HomeOccupancy',occ,'{"verification_status":"verified"}');
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,u),'HOME_SECRET_ACCESS_DENIED');
 DELETE FROM public."HomeAuditLog" WHERE home_id=h AND action='OCCUPANCY_TEMPLATE_APPLIED';
 INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,verification_status)
  VALUES(h,outsider,'member','member',false,'moved_out');
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,u),'HOME_SECRET_ACCESS_DENIED');
 DELETE FROM public."HomeOccupancy" WHERE home_id=h AND user_id=outsider;
 UPDATE public."HomeAccessSecret" SET created_by=outsider WHERE id=sid;
 PERFORM pg_temp.expect_secret(public.get_home_access_secrets(h,u),'HOME_SECRET_ACCESS_DENIED');
 UPDATE public."HomeAccessSecret" SET created_by=u WHERE id=sid;
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by) VALUES(h,u,'access.view_wifi',false,u);
 IF jsonb_array_length(public.get_home_access_secrets(h,u)->'secrets')<>0 THEN RAISE EXCEPTION 'Private WiFi deny ignored'; END IF;
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h;
 r:=public.mutate_home_access_secret(h,u,sid,'delete');
 IF r->>'deleted'<>'true' OR EXISTS(SELECT FROM public."HomeAccessSecretValue" WHERE access_secret_id=sid) THEN RAISE EXCEPTION 'Value cascade deletion failed'; END IF;
 r:=public.mutate_home_access_secret(h,u,null,'bootstrap_wifi','{"access_type":"wifi","label":"Name only","secret_value":""}');
 IF r->>'ok'<>'true' OR r->'secret'->>'has_secret'<>'false' THEN RAISE EXCEPTION 'Deleted own audit blocked name-only WiFi setup'; END IF;
 -- An own secret's retained deletion audit does not permanently block private
 -- Home cleanup. Proof-bearing Homes above retain the separate storage guard.
 h:='ddc50000-0000-4000-8000-000000000300';
 INSERT INTO public."Home"(id,created_by_user_id,address,city,state,zipcode) VALUES(h,u,'Private cleanup','Test','WA','98607');
 INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status) VALUES(h,u,'admin','admin','pending_doc');
 r:=public.mutate_home_access_secret(h,u,null,'create','{"access_type":"wifi","label":"Cleanup","secret_value":"fixture-cleanup"}');
 sid:=(r->'secret'->>'id')::uuid;
 IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Private cleanup secret creation failed'; END IF;
 PERFORM public.mutate_home_access_secret(h,u,sid,'delete');
 IF public.delete_home_authorized(h,u)->>'deleted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Own deleted secret audit blocked private Home cleanup'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ddc50000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 BEGIN PERFORM secret_value FROM public."HomeAccessSecretValue";
  RAISE EXCEPTION 'Direct secret value read was allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public."HomeAccessSecret" SET secret_value='client-bypass' WHERE home_id='ddc50000-0000-4000-8000-000000000100';
  RAISE EXCEPTION 'Direct secret update was allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_home_access_secrets('ddc50000-0000-4000-8000-000000000100','ddc50000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'Client invoked actor-bound service RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

DO $$ DECLARE t text; op text; BEGIN
 FOREACH t IN ARRAY ARRAY['HomeAccessSecret','HomeAccessSecretValue','HomeAccess'] LOOP
  FOREACH op IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
   IF has_table_privilege('authenticated',format('public.%I',t),op) OR has_table_privilege('anon',format('public.%I',t),op) THEN
    RAISE EXCEPTION 'Client retains % on %',op,t; END IF;
  END LOOP;
 END LOOP;
 IF has_function_privilege('authenticated','public.get_home_access_secrets(uuid,uuid)','execute')
   OR has_function_privilege('authenticated','public.mutate_home_access_secret(uuid,uuid,uuid,text,jsonb)','execute') THEN
  RAISE EXCEPTION 'Client can impersonate secret actor RPC'; END IF;
 IF (SELECT condeferrable FROM pg_constraint WHERE conname='HomeAccessSecretValue_access_secret_id_fkey') THEN
  RAISE EXCEPTION 'Secret child FK was weakened to deferred'; END IF;
 IF EXISTS(SELECT FROM public."HomeAccessSecret" WHERE home_id::text LIKE 'ddc50000-%' AND secret_value<>'') THEN
  RAISE EXCEPTION 'Secret plaintext found in metadata'; END IF;
 IF EXISTS(SELECT FROM public."HomeAuditLog" WHERE home_id::text LIKE 'ddc50000-%' AND metadata::text LIKE '%fixture-%') THEN
  RAISE EXCEPTION 'Secret bytes found in audit'; END IF;
 IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission" r)
  IS DISTINCT FROM (SELECT rows FROM secret_reference_before) THEN RAISE EXCEPTION 'Secret contract changed role defaults'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: atomic Home secret storage, typed permissions, private proof compatibility and rollback' AS result;
