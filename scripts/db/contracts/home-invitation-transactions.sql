-- Real canonical roles, identities and service-role admission. Fixtures roll back.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public,extensions,pg_catalog;
CREATE TEMP TABLE invitation_roles_before AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows
 FROM public."HomeRolePermission" r;
DO $$ DECLARE f text; t text; BEGIN
 IF (SELECT count(*) FROM public."HomeRolePermission")<>31 THEN RAISE EXCEPTION 'Expected shipped role rows'; END IF;
 FOREACH f IN ARRAY ARRAY['write_home_invitation(uuid,uuid,text,jsonb,text)',
  'act_on_home_invitation(uuid,text,uuid,text,integer)','list_home_invitations(uuid,uuid)',
  'list_home_household_requests(uuid,uuid,text)'] LOOP
  IF has_function_privilege('authenticated','public.'||f,'EXECUTE') OR has_function_privilege('anon','public.'||f,'EXECUTE')
   OR NOT has_function_privilege('service_role','public.'||f,'EXECUTE') THEN RAISE EXCEPTION 'Unsafe invite RPC ACL: %',f; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['HomeInvite','HomeHouseholdAccessRequest'] LOOP
  IF has_table_privilege('authenticated','public.'||quote_ident(t),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_table_privilege('anon','public.'||quote_ident(t),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
   RAISE EXCEPTION 'Direct invitation authority remains: %',t; END IF;
 END LOOP;
END $$;
INSERT INTO auth.users(id,email,email_confirmed_at)
 SELECT ('ddf00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'home-invitation-'||n||'@example.invalid',
 CASE WHEN n=12 THEN NULL ELSE now() END FROM generate_series(1,20)n;
INSERT INTO public."User"(id,email,username,name)
 SELECT id,email,'home_invitation_'||right(id::text,2),'Home invitation fixture'
 FROM auth.users WHERE id::text LIKE 'ddf00000-0000-4000-8000-%';
INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode,name) VALUES
 ('ddf00000-0000-4000-8000-000000000100','ddf00000-0000-4000-8000-000000000001','100 Secret Street','Test','WA','98607','Invite test');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner)
 VALUES('ddf00000-0000-4000-8000-000000000100','ddf00000-0000-4000-8000-000000000001','verified',true);
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,verification_status,
 start_at,end_at,access_start_at,access_end_at)
 SELECT 'ddf00000-0000-4000-8000-000000000100',('ddf00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 role,role::public.home_role_base,age::public.home_age_band,true,status,
 now()-interval '2 days',now()+interval '3 days',now()-interval '1 day',now()+interval '2 days'
 FROM (VALUES(1,'owner','adult','verified'),(2,'admin','adult','verified'),(3,'member',NULL,'pending_doc'),
 (4,'restricted_member','child','pending_approval'),(5,'member','teen','pending_doc'),
 (6,'member','adult','revoked'),(7,'member','adult','pending_doc'),(8,'admin','adult','pending_doc'))f(n,role,age,status);
INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES
 ('ddf00000-0000-4000-8000-000000000100','ddf00000-0000-4000-8000-000000000002','members.manage',true),
 ('ddf00000-0000-4000-8000-000000000100','ddf00000-0000-4000-8000-000000000003','finance.manage',false),
 ('ddf00000-0000-4000-8000-000000000100','ddf00000-0000-4000-8000-000000000007','finance.manage',true);
CREATE FUNCTION pg_temp.invitation_user(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('ddf00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
CREATE FUNCTION pg_temp.expect_invite(r jsonb,c text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF (c IS NULL AND r->>'ok' IS DISTINCT FROM 'true') OR (c IS NOT NULL AND r->>'code' IS DISTINCT FROM c) THEN
  RAISE EXCEPTION 'Expected %, got %',coalesce(c,'success'),r; END IF;
END $$;
CREATE FUNCTION pg_temp.invitation_state(h uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object(
  'invitations',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id),'[]') FROM public."HomeInvite" i WHERE home_id=h),
  'occupancies',(SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY id),'[]') FROM public."HomeOccupancy" o WHERE home_id=h),
  'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]') FROM public."HomeAuditLog" a WHERE home_id=h));
$$;
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.invitation_user(100); owner_id uuid:=pg_temp.invitation_user(1);
 admin_id uuid:=pg_temp.invitation_user(2); r jsonb; s jsonb; original jsonb; i uuid; n integer; state text;
 tok text:=repeat('a',64); request_id uuid; BEGIN
 -- Exact target identity wins over a public profile's mutable email.
 r:=public.write_home_invitation(h,owner_id,'create',jsonb_build_object('user_id',pg_temp.invitation_user(3),'relationship','member'),tok);
 PERFORM pg_temp.expect_invite(r); i:=(r->'invitation'->>'id')::uuid;
 IF r->'invitation'->>'token'<>tok OR r->'invitation' ? 'token_hash' OR r->'invitation' ? 'admission_policy'
  OR r->'invitation'->>'invitee_email' IS NOT NULL OR NOT EXISTS(SELECT FROM public."HomeInvite" WHERE id=i
   AND token=encode(sha256(convert_to(tok,'UTF8')),'hex') AND token_hash=token) THEN RAISE EXCEPTION 'Token or auth-email storage/DTO leaked'; END IF;
 UPDATE public."User" SET email='profile-only-3@example.invalid' WHERE id=pg_temp.invitation_user(3);
 UPDATE public."User" SET email='home-invitation-3@example.invalid' WHERE id=pg_temp.invitation_user(9);
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(NULL,tok,pg_temp.invitation_user(9),'accept'),'INVITE_EMAIL_MISMATCH');
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(i,NULL,pg_temp.invitation_user(9),'decline'),'INVITE_EMAIL_MISMATCH');
 r:=public.act_on_home_invitation(NULL,tok,NULL,'preview'); PERFORM pg_temp.expect_invite(r);
 IF r::text LIKE '%Secret Street%' OR r->'invitation' ? 'token_hash' OR r->'invitation' ? 'token' THEN RAISE EXCEPTION 'Preview leaked private data'; END IF;
 r:=public.list_home_invitations(pg_temp.invitation_user(3));
 IF jsonb_array_length(r->'invitations')<>1 OR r::text LIKE '%'||tok||'%' OR r::text LIKE '%token_hash%' THEN RAISE EXCEPTION 'Received invitation projection unsafe'; END IF;
 PERFORM pg_temp.expect_invite(public.list_home_invitations(pg_temp.invitation_user(3),h),'MEMBERS_MANAGE_REQUIRED');
 SELECT to_jsonb(o) INTO original FROM public."HomeOccupancy"o WHERE home_id=h AND user_id=pg_temp.invitation_user(3);
 r:=public.act_on_home_invitation(i,NULL,pg_temp.invitation_user(3),'accept'); PERFORM pg_temp.expect_invite(r);
 IF r->'occupancy'->>'verification_status'<>'verified' OR r->'occupancy'->>'age_band' IS NOT NULL
  OR (r->'occupancy'->>'start_at')::timestamptz<>(original->>'start_at')::timestamptz
  OR (r->'occupancy'->>'end_at')::timestamptz<>(original->>'end_at')::timestamptz
  OR public.home_has_permission(h,'finance.manage',pg_temp.invitation_user(3))
  OR public.home_get_user_permissions(h,pg_temp.invitation_user(3)) IS DISTINCT FROM ARRAY['home.view','tasks.edit','tasks.view']::text[] THEN RAISE EXCEPTION 'Admission widened dates, age, denies or shipped member grants'; END IF;
 SELECT count(*) INTO n FROM public."HomeAuditLog" WHERE home_id=h;
 s:=public.act_on_home_invitation(NULL,tok,pg_temp.invitation_user(3),'accept');
 IF s->>'replayed'<>'true' OR s->'occupancy' IS DISTINCT FROM r->'occupancy'
  OR (SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=h)<>n THEN RAISE EXCEPTION 'Acceptance replay mutated membership/audit'; END IF;
 UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=h AND user_id=pg_temp.invitation_user(3);
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(NULL,tok,pg_temp.invitation_user(3),'accept'),'INVITE_ALREADY_USED');
 -- Current role rank, complete future permission set, explicit minors and stale status.
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,admin_id,'create',jsonb_build_object('user_id',pg_temp.invitation_user(8)),repeat('b',64)),'PROPOSED_ROLE_FORBIDDEN');
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,admin_id,'create',jsonb_build_object('user_id',pg_temp.invitation_user(7)),repeat('b',64)),'PERMISSION_DELEGATION_FORBIDDEN');
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create',jsonb_build_object('user_id',pg_temp.invitation_user(4),'relationship','admin'),repeat('b',64)),'PROPOSED_ROLE_FORBIDDEN');
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create',jsonb_build_object('user_id',pg_temp.invitation_user(5),'relationship','lease_resident'),repeat('b',64)),'PROPOSED_ROLE_FORBIDDEN');
 FOREACH state IN ARRAY ARRAY['revoked','suspended','moved_out','unknown',NULL] LOOP
  UPDATE public."HomeOccupancy" SET verification_status=state WHERE home_id=h AND user_id=pg_temp.invitation_user(6);
  PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create',jsonb_build_object('user_id',pg_temp.invitation_user(6)),repeat('b',64)),'MEMBERSHIP_RENEWAL_REQUIRED');
 END LOOP;
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create','{"relationship":"owner"}',repeat('b',64)),'OWNER_INVITE_FORBIDDEN');
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create','{"preset_key":"claim_merge:bad"}',repeat('b',64)),'CLAIM_MERGE_PRESET_FORBIDDEN');
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create','{"relationship":"unknown"}',repeat('b',64)),'INVITE_POLICY_INVALID');
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create','{"relationship":"manager"}',repeat('b',64)),'TARGETED_INVITE_REQUIRED');
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create','{"start_at":"2099-01-01"}',repeat('b',64)),'INVITE_DATES_INVALID');
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create',jsonb_build_object('user_id',pg_temp.invitation_user(9),'email','wrong@example.invalid'),repeat('b',64)),'INVITE_RECIPIENT_MISMATCH');
 -- Child fallback is a real restriction even when no role preset seed exists.
 r:=public.write_home_invitation(h,owner_id,'create','{"relationship":"restricted_member","preset_key":"child"}',repeat('b',64)); PERFORM pg_temp.expect_invite(r);
 i:=(r->'invitation'->>'id')::uuid;
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(i,NULL,pg_temp.invitation_user(9),'accept'),'INVITE_EMAIL_MISMATCH');
 r:=public.act_on_home_invitation(NULL,repeat('b',64),pg_temp.invitation_user(9),'decline'); PERFORM pg_temp.expect_invite(r);
 IF (SELECT status FROM public."HomeInvite" WHERE id=i)<>'pending' THEN RAISE EXCEPTION 'Open-link viewer globally revoked invitation'; END IF;
 r:=public.act_on_home_invitation(NULL,repeat('b',64),pg_temp.invitation_user(9),'accept'); PERFORM pg_temp.expect_invite(r);
 IF r->'occupancy'->>'age_band'<>'child' OR public.home_has_permission(h,'finance.manage',pg_temp.invitation_user(9)) THEN RAISE EXCEPTION 'Child invitation escaped age ceiling'; END IF;
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(NULL,repeat('b',64),pg_temp.invitation_user(10),'accept'),'INVITE_ALREADY_USED');
 -- Future access remains future and acceptance narrows existing windows.
 r:=public.write_home_invitation(h,owner_id,'create',jsonb_build_object('user_id',pg_temp.invitation_user(4),'relationship','restricted_member',
  'start_at',now()+interval '1 hour','end_at',now()+interval '1 day'),repeat('c',64));
 PERFORM pg_temp.expect_invite(r);
 r:=public.act_on_home_invitation(NULL,repeat('c',64),pg_temp.invitation_user(4),'accept'); PERFORM pg_temp.expect_invite(r);
 IF public.home_is_active_member(h,pg_temp.invitation_user(4)) OR (r->'occupancy'->>'can_manage_tasks')::boolean
  OR (r->'occupancy'->>'access_end_at')::timestamptz>now()+interval '1 day' THEN RAISE EXCEPTION 'Future/window restriction widened'; END IF;
 -- Policy changes after issue cannot silently add grants to a sent token.
 r:=public.write_home_invitation(h,owner_id,'create',jsonb_build_object('user_id',pg_temp.invitation_user(10)),repeat('d',64)); PERFORM pg_temp.expect_invite(r);
 -- A real change to an installed default must invalidate the old snapshot.
 UPDATE public."HomeRolePermission" SET allowed=false WHERE role_base='member' AND permission='tasks.view';
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(NULL,repeat('d',64),pg_temp.invitation_user(10),'accept'),'INVITE_POLICY_CHANGED');
 UPDATE public."HomeRolePermission" SET allowed=true WHERE role_base='member' AND permission='tasks.view';
 -- Original issuers require current authority to revoke a targeted invitation.
 i:=(r->'invitation'->>'id')::uuid;
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,owner_id,'members.manage',false);
 original:=pg_temp.invitation_state(h);
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(NULL,repeat('d',64),pg_temp.invitation_user(10),'accept'),'INVITER_ACCESS_CHANGED');
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(NULL,repeat('d',64),NULL,'preview'),'INVITER_ACCESS_CHANGED');
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create','{}',repeat('e',64)),'MEMBERS_MANAGE_REQUIRED');
 r:=public.act_on_home_invitation(NULL,repeat('d',64),owner_id,'decline');
 PERFORM pg_temp.expect_invite(r,'INVITE_EMAIL_MISMATCH');
 IF r->>'status' IS DISTINCT FROM '403' THEN RAISE EXCEPTION 'Denied issuer token response was not forbidden'; END IF;
 r:=public.act_on_home_invitation(i,NULL,owner_id,'decline');
 PERFORM pg_temp.expect_invite(r,'INVITE_EMAIL_MISMATCH');
 IF r->>'status' IS DISTINCT FROM '403' OR pg_temp.invitation_state(h) IS DISTINCT FROM original THEN
  RAISE EXCEPTION 'Denied issuer changed invitation, occupancy or audit'; END IF;
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=owner_id AND permission='members.manage' AND NOT allowed;
 r:=public.act_on_home_invitation(NULL,repeat('d',64),owner_id,'decline'); PERFORM pg_temp.expect_invite(r);
 s:=pg_temp.invitation_state(h);
 IF r->>'replayed' IS DISTINCT FROM 'false' OR (SELECT status FROM public."HomeInvite" WHERE id=i) IS DISTINCT FROM 'revoked'
  OR s->'occupancies' IS DISTINCT FROM original->'occupancies'
  OR jsonb_array_length(s->'audit')<>jsonb_array_length(original->'audit')+1
  OR NOT EXISTS(SELECT FROM public."HomeAuditLog" WHERE home_id=h AND actor_user_id=owner_id
    AND target_id=i AND action='HOME_INVITE_REVOKED') THEN
  RAISE EXCEPTION 'Authorized issuer did not revoke once with membership preserved'; END IF;
 r:=public.act_on_home_invitation(i,NULL,owner_id,'decline'); PERFORM pg_temp.expect_invite(r);
 IF r->>'replayed' IS DISTINCT FROM 'true' OR pg_temp.invitation_state(h) IS DISTINCT FROM s THEN
  RAISE EXCEPTION 'Authorized issuer replay changed invitation, occupancy or audit'; END IF;
 FOREACH state IN ARRAY ARRAY['pending_doc','suspended','revoked',NULL] LOOP
  UPDATE public."HomeOccupancy" SET verification_status=state WHERE home_id=h AND user_id=owner_id;
  PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create','{}',repeat('6',64)),'MEMBERS_MANAGE_REQUIRED');
  PERFORM pg_temp.expect_invite(public.list_home_household_requests(h,owner_id),'MEMBERS_MANAGE_REQUIRED');
 END LOOP;
 UPDATE public."HomeOccupancy" SET verification_status='verified',age_band='child' WHERE home_id=h AND user_id=owner_id;
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create','{}',repeat('6',64)),'MEMBERS_MANAGE_REQUIRED');
 UPDATE public."HomeOccupancy" SET age_band='teen' WHERE home_id=h AND user_id=owner_id;
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create','{}',repeat('6',64)),'MEMBERS_MANAGE_REQUIRED');
 UPDATE public."HomeOccupancy" SET age_band='adult',access_end_at=now() WHERE home_id=h AND user_id=owner_id;
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create','{}',repeat('6',64)),'MEMBERS_MANAGE_REQUIRED');
 UPDATE public."HomeOccupancy" SET access_end_at=now()+interval '2 days' WHERE home_id=h AND user_id=owner_id;
 UPDATE public."HomeOwner" SET owner_status='revoked' WHERE home_id=h AND subject_id=owner_id;
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'create','{}',repeat('6',64)),'MEMBERS_MANAGE_REQUIRED');
 UPDATE public."HomeOwner" SET owner_status='verified' WHERE home_id=h AND subject_id=owner_id;
 -- Presets cannot erase a target's explicit deny, even when the inviter owns the permission.
 INSERT INTO public."HomeRolePreset"(key,display_name,role_base,grant_perms,deny_perms)
  VALUES('invitation_fixture','Invitation fixture','member',ARRAY['finance.manage']::public.home_permission[],ARRAY['tasks.edit']::public.home_permission[]);
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed)
  VALUES(h,pg_temp.invitation_user(19),'finance.manage',false);
 r:=public.write_home_invitation(h,owner_id,'create',jsonb_build_object('user_id',pg_temp.invitation_user(19),'preset_key','invitation_fixture'),repeat('8',64));
 PERFORM pg_temp.expect_invite(r);
 r:=public.act_on_home_invitation(NULL,repeat('8',64),pg_temp.invitation_user(19),'accept'); PERFORM pg_temp.expect_invite(r);
 IF public.home_has_permission(h,'finance.manage',pg_temp.invitation_user(19))
  OR NOT EXISTS(SELECT FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=pg_temp.invitation_user(19)
    AND permission='finance.manage' AND NOT allowed)
  OR NOT EXISTS(SELECT FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=pg_temp.invitation_user(19)
    AND permission='tasks.edit' AND NOT allowed) THEN RAISE EXCEPTION 'Preset erased restrictive override'; END IF;
 -- An expired invitation is unavailable, and preview exposes status only.
 r:=public.write_home_invitation(h,owner_id,'create','{}',repeat('6',64)); PERFORM pg_temp.expect_invite(r);
 i:=(r->'invitation'->>'id')::uuid;
 UPDATE public."HomeInvite" SET expires_at=now() WHERE id=i;
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(NULL,repeat('6',64),pg_temp.invitation_user(18),'accept'),'INVITE_EXPIRED');
 s:=public.act_on_home_invitation(NULL,repeat('6',64),NULL,'preview');
 IF s->'invitation'<>jsonb_build_object('id',i,'status','expired') OR s ? 'home' THEN RAISE EXCEPTION 'Expired preview leaked household'; END IF;
 -- Unregistered/email-bound recipients must verify auth email; mutable profile is irrelevant.
 r:=public.write_home_invitation(h,owner_id,'create','{"email":"home-invitation-12@example.invalid"}',repeat('e',64)); PERFORM pg_temp.expect_invite(r);
 IF r->'invitation'->>'invitee_user_id' IS NOT NULL THEN RAISE EXCEPTION 'Unverified email bound prematurely'; END IF;
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(NULL,repeat('e',64),pg_temp.invitation_user(12),'accept'),'INVITE_EMAIL_MISMATCH');
END $$;
RESET ROLE;
-- Auth confirmation is an external identity fixture operation, never a service-role grant.
UPDATE auth.users SET email_confirmed_at=now() WHERE id=pg_temp.invitation_user(12);
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.invitation_user(100); owner_id uuid:=pg_temp.invitation_user(1);
 r jsonb; s jsonb; i uuid; request_id uuid; BEGIN
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(NULL,repeat('e',64),pg_temp.invitation_user(12),'accept'));
 -- Household intent alone grants nothing; only exact reviewed request converts atomically.
 r:=public.write_home_invitation(h,pg_temp.invitation_user(13),'request','{"requested_identity":"owner"}'); PERFORM pg_temp.expect_invite(r);
 request_id:=(r->>'request_id')::uuid;
 s:=public.list_home_household_requests(h,owner_id);
 IF jsonb_array_length(s->'requests')<>1 OR s->'requests'->0->'requester'->>'id'<>pg_temp.invitation_user(13)::text
   OR s::text LIKE '%email%' THEN RAISE EXCEPTION 'Request list leaked profile or lost exact source'; END IF;
 PERFORM pg_temp.expect_invite(public.list_home_household_requests(h,pg_temp.invitation_user(13)),'MEMBERS_MANAGE_REQUIRED');
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'approve_request',jsonb_build_object('request_id',request_id),repeat('f',64)),'OWNERSHIP_FLOW_REQUIRED');
 IF (SELECT status FROM public."HomeHouseholdAccessRequest" WHERE id=request_id)<>'pending' THEN RAISE EXCEPTION 'Ownership request partly approved'; END IF;
 r:=public.write_home_invitation(h,pg_temp.invitation_user(13),'request','{"requested_identity":"household_member"}');
 IF (r->>'request_id')::uuid<>request_id THEN RAISE EXCEPTION 'Intent update duplicated pending request'; END IF;
 r:=public.write_home_invitation(h,owner_id,'approve_request',jsonb_build_object('request_id',request_id),repeat('f',64)); PERFORM pg_temp.expect_invite(r);
 i:=(r->'invitation'->>'id')::uuid;
 IF EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=h AND user_id=pg_temp.invitation_user(13))
  OR r->'invitation'->>'invitee_user_id'<>pg_temp.invitation_user(13)::text THEN RAISE EXCEPTION 'Request approval granted access or changed target'; END IF;
 s:=public.write_home_invitation(h,owner_id,'approve_request',jsonb_build_object('request_id',request_id),repeat('9',64));
 IF s->>'replayed'<>'true' OR s ? 'invitation' THEN RAISE EXCEPTION 'Request retry minted duplicate invite/token'; END IF;
 UPDATE public."HomeHouseholdAccessRequest" SET requested_identity='owner' WHERE id=request_id;
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(i,NULL,pg_temp.invitation_user(13),'accept'),'INVITE_SOURCE_CHANGED');
 UPDATE public."HomeHouseholdAccessRequest" SET requested_identity='household_member' WHERE id=request_id;
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(i,NULL,pg_temp.invitation_user(13),'accept'));
 r:=public.write_home_invitation(h,pg_temp.invitation_user(14),'request','{"requested_identity":"guest"}');
 request_id:=(r->>'request_id')::uuid;
 PERFORM pg_temp.expect_invite(public.write_home_invitation(h,owner_id,'reject_request',jsonb_build_object('request_id',request_id)));
 s:=public.write_home_invitation(h,owner_id,'reject_request',jsonb_build_object('request_id',request_id));
 IF s->>'replayed'<>'true' THEN RAISE EXCEPTION 'Request rejection retry failed'; END IF;
END $$;
RESET ROLE;
-- Actual legacy hash-null and reserved ownership links retain distinct behavior.
INSERT INTO public."HomeInvite"(home_id,invited_by,invitee_user_id,proposed_role,token,token_hash,expires_at,proposed_preset_key)
 VALUES(pg_temp.invitation_user(100),pg_temp.invitation_user(1),pg_temp.invitation_user(15),'member','legacy-invitation-fixture',NULL,now()+interval '1 day',NULL),
 (pg_temp.invitation_user(100),pg_temp.invitation_user(1),pg_temp.invitation_user(16),'owner','ownership-invitation-fixture',NULL,now()+interval '1 day','claim_merge:fixture');
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; BEGIN
 PERFORM pg_temp.expect_invite(public.act_on_home_invitation(NULL,'legacy-invitation-fixture',pg_temp.invitation_user(15),'accept'));
 r:=public.act_on_home_invitation(NULL,'ownership-invitation-fixture',pg_temp.invitation_user(16),'accept');
 IF r->>'kind'<>'claim_merge' OR EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=pg_temp.invitation_user(100)
  AND user_id=pg_temp.invitation_user(16)) THEN RAISE EXCEPTION 'Ownership link fell through to ordinary enrollment'; END IF;
END $$;
RESET ROLE;
-- Audit failure must roll back invitation consumption AND new occupancy.
CREATE FUNCTION pg_temp.reject_invitation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.home_id=pg_temp.invitation_user(100) AND NEW.action='HOME_INVITE_ACCEPTED' THEN
  RAISE EXCEPTION 'fixture invitation audit failure' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER invitation_fixture_audit_failure BEFORE INSERT ON public."HomeAuditLog"
 FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_invitation_audit();
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; i uuid; BEGIN
 r:=public.write_home_invitation(pg_temp.invitation_user(100),pg_temp.invitation_user(1),'create',
  jsonb_build_object('user_id',pg_temp.invitation_user(17)),repeat('7',64)); PERFORM pg_temp.expect_invite(r);
 i:=(r->'invitation'->>'id')::uuid;
 BEGIN
  PERFORM public.act_on_home_invitation(i,NULL,pg_temp.invitation_user(17),'accept');
  RAISE EXCEPTION 'Expected audit failure';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=pg_temp.invitation_user(100) AND user_id=pg_temp.invitation_user(17))
  OR NOT EXISTS(SELECT FROM public."HomeInvite" WHERE id=i AND status='pending' AND accepted_by_user_id IS NULL) THEN
  RAISE EXCEPTION 'Invitation audit failure left partial admission'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT rows FROM invitation_roles_before) IS DISTINCT FROM
  (SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission"r) THEN
  RAISE EXCEPTION 'Invitation changed role defaults'; END IF;
END $$;
ROLLBACK;
