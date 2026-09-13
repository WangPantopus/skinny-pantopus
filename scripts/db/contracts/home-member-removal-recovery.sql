-- Protected removal receipt semantics, semantic generations and legacy no-op
-- boundaries. Synthetic later grants below test SQL robustness only; shipped
-- renewal/targeted-sharing refusal remains a separate actual HTTP limit.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public,extensions,pg_catalog;
CREATE FUNCTION pg_temp.rm_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$SELECT ('ddc26400-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;$$;
DO $$ BEGIN
 ASSERT NOT has_table_privilege('authenticated','public."HomeMemberRemovalCommand"','SELECT,INSERT,UPDATE,DELETE');
 ASSERT NOT has_table_privilege('anon','public."HomeMemberRemovalCommand"','SELECT,INSERT,UPDATE,DELETE');
 ASSERT NOT has_function_privilege('authenticated','public.resolve_home_member_removal(uuid,uuid,jsonb,boolean)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.apply_home_member_removal(uuid,uuid,uuid)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.resolve_home_member_removal(uuid,uuid,jsonb,boolean)','EXECUTE');
 ASSERT NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public."HomeMemberRemovalCommand"'::regclass AND contype='f');
END $$;
INSERT INTO auth.users(id,email) SELECT pg_temp.rm_id(n),'removal-contract-'||n||'@example.invalid' FROM generate_series(1,7)n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'removal_contract_'||right(id::text,1),'Private legal account name' FROM auth.users WHERE id::text LIKE 'ddc26400-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,name,address,city,state,zipcode) VALUES(pg_temp.rm_id(100),pg_temp.rm_id(1),pg_temp.rm_id(1),'Removal contract','Removal contract','Test','WA','98607');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES(pg_temp.rm_id(100),pg_temp.rm_id(1),'verified',true),(pg_temp.rm_id(100),pg_temp.rm_id(6),'verified',false);
INSERT INTO public."HomeOccupancy"(id,home_id,user_id,role,role_base,age_band,verification_status,start_at)
 SELECT pg_temp.rm_id(200+n),pg_temp.rm_id(100),pg_temp.rm_id(n),CASE WHEN n IN(1,6) THEN 'owner' ELSE 'member' END,
 (CASE WHEN n IN(1,6) THEN 'owner' ELSE 'member' END)::public.home_role_base,'adult','verified',now()-interval '1 day' FROM generate_series(1,6)n;
INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(pg_temp.rm_id(100),pg_temp.rm_id(2),'finance.manage',false);
CREATE FUNCTION pg_temp.rm_intent(c jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$SELECT c-ARRAY['ok','home','target'];$$;
CREATE FUNCTION pg_temp.rm_state() RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object(
 'occupancy',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."HomeOccupancy"r WHERE home_id=pg_temp.rm_id(100)),
 'overrides',(SELECT jsonb_agg(to_jsonb(r) ORDER BY user_id,permission) FROM public."HomePermissionOverride"r WHERE home_id=pg_temp.rm_id(100)),
 'grants',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."HomeScopedGrant"r WHERE home_id=pg_temp.rm_id(100)),
 'audit',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."HomeAuditLog"r WHERE home_id=pg_temp.rm_id(100)));$$;
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.rm_id(100);a uuid:=pg_temp.rm_id(1);u uuid:=pg_temp.rm_id(2); c jsonb;r jsonb;s jsonb;original jsonb;v uuid;v2 uuid; BEGIN
 s:=pg_temp.rm_state();c:=public.prepare_home_member_removal(a,h,u);ASSERT c->>'ok'='true';ASSERT c->'target'->'name'='null'::jsonb;
 ASSERT c->'target'->>'username'='removal_contract_2';ASSERT c->'target'->>'role_base'='member';ASSERT pg_temp.rm_state()=s;
 ASSERT public.prepare_home_member_removal(a,h,a)->>'code'='TRANSFER_REQUIRED';
 ASSERT public.prepare_home_member_removal(a,h,pg_temp.rm_id(6))->>'code'='OWNERSHIP_FLOW_REQUIRED';
 ASSERT public.prepare_home_member_removal(pg_temp.rm_id(3),h,u)->>'code'='MEMBERS_MANAGE_REQUIRED';
 original:=pg_temp.rm_intent(c);
 r:=public.resolve_home_member_removal(a,pg_temp.rm_id(501),original,true);ASSERT r->>'state'='cancelled';
 ASSERT public.resolve_home_member_removal(a,pg_temp.rm_id(501),original)->>'state'='cancelled';ASSERT pg_temp.rm_state()=s;
 ASSERT public.resolve_home_member_removal(a,pg_temp.rm_id(501),original||jsonb_build_object('decision_token',repeat('b',64)))->>'code'='MEMBER_REMOVAL_CONFLICT';
 ASSERT public.get_home_member_removal(pg_temp.rm_id(3),pg_temp.rm_id(501))->>'code'='MEMBER_REMOVAL_NOT_FOUND';
 SELECT membership_version INTO v FROM public."HomeOccupancy" WHERE id=pg_temp.rm_id(202);ASSERT v IS NOT NULL;
 UPDATE public."HomeOccupancy" SET updated_at=clock_timestamp(),density_milestone_seen=density_milestone_seen+1,membership_version=pg_temp.rm_id(999) WHERE id=pg_temp.rm_id(202);
 ASSERT (SELECT membership_version=v FROM public."HomeOccupancy" WHERE id=pg_temp.rm_id(202));
 ASSERT public.prepare_home_member_removal(a,h,u)->>'decision_token'=c->>'decision_token';
 UPDATE public."HomeOccupancy" SET role_base='guest',role='guest' WHERE id=pg_temp.rm_id(202) RETURNING membership_version INTO v2;ASSERT v2<>v;
 UPDATE public."HomeOccupancy" SET role_base='member',role='member',membership_version=v WHERE id=pg_temp.rm_id(202);ASSERT (SELECT membership_version<>v AND membership_version<>v2 FROM public."HomeOccupancy" WHERE id=pg_temp.rm_id(202));
 s:=pg_temp.rm_state();ASSERT public.resolve_home_member_removal(a,pg_temp.rm_id(502),original)->>'code'='MEMBER_REMOVAL_CHANGED';ASSERT pg_temp.rm_state()=s;
 c:=public.prepare_home_member_removal(a,h,u);original:=pg_temp.rm_intent(c);r:=public.resolve_home_member_removal(a,pg_temp.rm_id(503),original);ASSERT r->>'state'='completed';ASSERT r->>'completed_at' IS NOT NULL;
 ASSERT NOT EXISTS(SELECT FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=u);
 s:=pg_temp.rm_state();ASSERT public.resolve_home_member_removal(a,pg_temp.rm_id(503),original)->>'replayed'='true';
 ASSERT public.resolve_home_member_removal(a,pg_temp.rm_id(503),original,true)->>'state'='completed';ASSERT pg_temp.rm_state()=s;
 ASSERT public.prepare_home_member_removal(a,h,u)->>'code'='MEMBER_ALREADY_REMOVED';
 -- A later independently introduced access row is never swept up by an old
 -- terminal legacy retry. This is an isolated adversarial SQL state, not a
 -- claim that the shipped targeted-grant endpoint admits ended occupants.
 INSERT INTO public."HomeScopedGrant"(home_id,grantee_user_id,resource_type,resource_id) VALUES(h,u,'HomeTask',pg_temp.rm_id(800));
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,u,'tasks.view',true);
 s:=pg_temp.rm_state();ASSERT public.mutate_home_member(h,a,u,'remove')->>'ok'='true';ASSERT pg_temp.rm_state()=s;
 ASSERT public.resolve_home_member_removal(a,pg_temp.rm_id(503),original)->>'state'='completed';ASSERT pg_temp.rm_state()=s;
 -- Replay is historical even when the actor subsequently loses current power.
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,a,'members.manage',false);
 s:=pg_temp.rm_state();ASSERT public.resolve_home_member_removal(a,pg_temp.rm_id(503),original)->>'state'='completed';ASSERT pg_temp.rm_state()=s;
 ASSERT public.mutate_home_member(h,a,u,'remove')->>'code'='MEMBERS_MANAGE_REQUIRED';ASSERT pg_temp.rm_state()=s;
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=a AND permission='members.manage';
END $$;
-- Nonfinite historical timestamps are representable in the baseline. First
-- removal canonicalizes them; repeat neither rewrites time nor repeats audit.
DO $$ DECLARE value text;s jsonb;BEGIN
 FOREACH value IN ARRAY ARRAY['-infinity','infinity'] LOOP
  UPDATE public."HomeOccupancy" SET is_active=false,verification_status='inactive',end_at=value::timestamptz,
    can_manage_home=false,can_manage_access=false,can_manage_finance=false,can_manage_tasks=false,can_view_sensitive=false
    WHERE id=pg_temp.rm_id(205);
  ASSERT public.mutate_home_member(pg_temp.rm_id(100),pg_temp.rm_id(1),pg_temp.rm_id(5),'remove')->>'ok'='true';
  ASSERT (SELECT isfinite(end_at) AND end_at<=clock_timestamp() FROM public."HomeOccupancy" WHERE id=pg_temp.rm_id(205));
  s:=pg_temp.rm_state();ASSERT public.mutate_home_member(pg_temp.rm_id(100),pg_temp.rm_id(1),pg_temp.rm_id(5),'remove')->>'ok'='true';
  ASSERT pg_temp.rm_state()=s;
 END LOOP;
END $$;
RESET ROLE;
-- Receipt or audit failure rolls back every effect and the pending insertion.
CREATE FUNCTION pg_temp.rm_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Controlled removal atomicity failure';END $$;
CREATE TRIGGER removal_contract_receipt_failure BEFORE UPDATE ON public."HomeMemberRemovalCommand" FOR EACH ROW EXECUTE FUNCTION pg_temp.rm_fail();
DO $$ DECLARE c jsonb;s jsonb;failed boolean:=false;BEGIN
 c:=public.prepare_home_member_removal(pg_temp.rm_id(1),pg_temp.rm_id(100),pg_temp.rm_id(3));s:=pg_temp.rm_state();
 BEGIN PERFORM public.resolve_home_member_removal(pg_temp.rm_id(1),pg_temp.rm_id(504),pg_temp.rm_intent(c));EXCEPTION WHEN raise_exception THEN failed:=true;END;
 ASSERT failed;ASSERT s=pg_temp.rm_state();ASSERT NOT EXISTS(SELECT FROM public."HomeMemberRemovalCommand" WHERE request_id=pg_temp.rm_id(504));
END $$;
DROP TRIGGER removal_contract_receipt_failure ON public."HomeMemberRemovalCommand";
CREATE TRIGGER removal_contract_audit_failure BEFORE INSERT ON public."HomeAuditLog" FOR EACH ROW EXECUTE FUNCTION pg_temp.rm_fail();
DO $$ DECLARE c jsonb;s jsonb;failed boolean:=false;BEGIN
 c:=public.prepare_home_member_removal(pg_temp.rm_id(1),pg_temp.rm_id(100),pg_temp.rm_id(3));s:=pg_temp.rm_state();
 BEGIN PERFORM public.resolve_home_member_removal(pg_temp.rm_id(1),pg_temp.rm_id(505),pg_temp.rm_intent(c));EXCEPTION WHEN raise_exception THEN failed:=true;END;
 ASSERT failed;ASSERT s=pg_temp.rm_state();ASSERT NOT EXISTS(SELECT FROM public."HomeMemberRemovalCommand" WHERE request_id=pg_temp.rm_id(505));
END $$;
DROP TRIGGER removal_contract_audit_failure ON public."HomeAuditLog";
SET LOCAL ROLE service_role;
DO $$ DECLARE c jsonb;r jsonb;original jsonb;BEGIN
 c:=public.prepare_home_member_removal(pg_temp.rm_id(6),pg_temp.rm_id(100),pg_temp.rm_id(6));ASSERT c->>'ok'='true';original:=pg_temp.rm_intent(c);
 r:=public.resolve_home_member_removal(pg_temp.rm_id(6),pg_temp.rm_id(506),original);ASSERT r->>'state'='completed';ASSERT jsonb_array_length(r->'_notify_user_ids')>0;
 ASSERT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=pg_temp.rm_id(100) AND subject_id=pg_temp.rm_id(6) AND owner_status='revoked');
 ASSERT (SELECT vacancy_at IS NULL FROM public."Home" WHERE id=pg_temp.rm_id(100));
 ASSERT NOT(public.resolve_home_member_removal(pg_temp.rm_id(6),pg_temp.rm_id(506),original)?'_notify_user_ids');
 ASSERT NOT(public.get_home_member_removal(pg_temp.rm_id(6),pg_temp.rm_id(506))?'_notify_user_ids');
 ASSERT NOT(public.resolve_home_member_removal(pg_temp.rm_id(6),pg_temp.rm_id(506),original,true)?'_notify_user_ids');
END $$;
RESET ROLE;
ROLLBACK;
