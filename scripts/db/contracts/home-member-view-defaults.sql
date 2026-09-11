-- Current admission, not an address or invitation alone, enables the overview.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public,extensions,pg_catalog;
CREATE TEMP TABLE member_view_defaults_before AS
 SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows FROM public."HomeRolePermission" r;
GRANT SELECT ON member_view_defaults_before TO service_role;
CREATE FUNCTION pg_temp.mv_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('ddc25000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
CREATE FUNCTION pg_temp.mv_ok(r jsonb,code text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF (code IS NULL AND r->>'ok' IS DISTINCT FROM 'true') OR (code IS NOT NULL AND r->>'code' IS DISTINCT FROM code)
 THEN RAISE EXCEPTION 'Expected %, got %',coalesce(code,'success'),r; END IF;
END $$;
INSERT INTO auth.users(id,email,email_confirmed_at)
 SELECT pg_temp.mv_id(n),'member-view-'||n||'@example.invalid',now() FROM generate_series(1,9)n;
INSERT INTO public."User"(id,email,username,name)
 SELECT id,email,'member_view_'||right(id::text,2),'Member view fixture'
 FROM auth.users WHERE id::text LIKE 'ddc25000-0000-4000-8000-%';
INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode)
 VALUES(pg_temp.mv_id(100),pg_temp.mv_id(1),'100 Member View Test','Test','WA','98607');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner)
 VALUES(pg_temp.mv_id(100),pg_temp.mv_id(1),'verified',true);
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status,age_band)
 SELECT pg_temp.mv_id(100),pg_temp.mv_id(n),role,role::public.home_role_base,'pending_doc',
 CASE WHEN role='restricted_member' THEN 'child'::public.home_age_band ELSE 'adult'::public.home_age_band END
 FROM (VALUES (2,'admin'),(3,'manager'),(4,'member'),(5,'restricted_member'),(6,'guest'))r(n,role);
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.mv_id(100); o uuid:=pg_temp.mv_id(1); u uuid; r jsonb; original jsonb;
 role_name text; state text; n integer:=1; invite uuid; policy jsonb;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['admin','manager','member','restricted_member','guest'] LOOP
  n:=n+1; u:=pg_temp.mv_id(n);
  IF NOT EXISTS(SELECT FROM public."HomeRolePermission" WHERE role_base::text=role_name
    AND permission='home.view' AND allowed) THEN RAISE EXCEPTION 'Missing overview default: %',role_name; END IF;
  IF public.home_has_permission(h,'home.view',u) THEN RAISE EXCEPTION 'Pending member admitted: %',role_name; END IF;
  r:=public.write_home_invitation(h,o,'create',jsonb_build_object('user_id',u,'relationship',role_name),repeat(n::text,64));
  PERFORM pg_temp.mv_ok(r); invite:=(r->'invitation'->>'id')::uuid;
  IF public.home_has_permission(h,'home.view',u) THEN RAISE EXCEPTION 'Invitation itself granted access'; END IF;
  SELECT to_jsonb(c) INTO original FROM public."HomeOccupancy" c WHERE home_id=h AND user_id=u;
  PERFORM pg_temp.mv_ok(public.act_on_home_invitation(invite,NULL,u,'accept'));
  IF NOT public.home_has_permission(h,'home.view',u)
    OR public.home_my_role(h,u)::text<>role_name
    OR EXISTS(SELECT FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=u)
    OR (SELECT age_band::text FROM public."HomeOccupancy" WHERE home_id=h AND user_id=u)
      IS DISTINCT FROM original->>'age_band'
    THEN RAISE EXCEPTION 'Accepted role lost exact defaults/age: %',role_name; END IF;
  IF role_name IN ('member','restricted_member','guest') AND
    public.home_get_user_permissions(h,u) IS DISTINCT FROM ARRAY['home.view']::text[]
    THEN RAISE EXCEPTION 'Overview default widened entity/write permissions: %',role_name; END IF;
  FOREACH state IN ARRAY ARRAY['pending_doc','provisional_bootstrap','revoked','suspended','moved_out'] LOOP
   UPDATE public."HomeOccupancy" SET verification_status=state WHERE home_id=h AND user_id=u;
   IF public.home_has_permission(h,'home.view',u) THEN RAISE EXCEPTION 'Status bypassed current admission: %',state; END IF;
  END LOOP;
  UPDATE public."HomeOccupancy" SET verification_status='verified',access_start_at=now()+interval '1 day'
   WHERE home_id=h AND user_id=u;
  IF public.home_has_permission(h,'home.view',u) THEN RAISE EXCEPTION 'Future access admitted'; END IF;
  UPDATE public."HomeOccupancy" SET access_start_at=NULL,access_end_at=now()-interval '1 second' WHERE home_id=h AND user_id=u;
  IF public.home_has_permission(h,'home.view',u) THEN RAISE EXCEPTION 'Expired access admitted'; END IF;
  UPDATE public."HomeOccupancy" SET access_end_at=NULL WHERE home_id=h AND user_id=u;
  INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,u,'home.view',false);
  IF public.home_has_permission(h,'home.view',u) THEN RAISE EXCEPTION 'Overview default bypassed personal deny'; END IF;
  DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=u AND permission='home.view';
  IF NOT public.home_has_permission(h,'home.view',u) THEN RAISE EXCEPTION 'Current access failed to recover'; END IF;
 END LOOP;
 -- A saved invitation from the former member policy cannot silently acquire
 -- the new permission. Its recipient can decline and request a fresh invitation.
 r:=public.write_home_invitation(h,o,'create',jsonb_build_object('user_id',pg_temp.mv_id(7),'relationship','member'),repeat('a',64));
 PERFORM pg_temp.mv_ok(r); invite:=(r->'invitation'->>'id')::uuid;
 UPDATE public."HomeInvite" SET admission_policy=jsonb_set(admission_policy,'{role_defaults}','[]') WHERE id=invite;
 SELECT admission_policy INTO policy FROM public."HomeInvite" WHERE id=invite;
 PERFORM pg_temp.mv_ok(public.act_on_home_invitation(invite,NULL,pg_temp.mv_id(7),'accept'),'INVITE_POLICY_CHANGED');
 IF EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=h AND user_id=pg_temp.mv_id(7))
   OR (SELECT admission_policy FROM public."HomeInvite" WHERE id=invite) IS DISTINCT FROM policy
   THEN RAISE EXCEPTION 'Old invitation policy was rewritten or admitted'; END IF;
 PERFORM pg_temp.mv_ok(public.act_on_home_invitation(invite,NULL,pg_temp.mv_id(7),'decline'));
 r:=public.write_home_invitation(h,o,'create',jsonb_build_object('user_id',pg_temp.mv_id(7),'relationship','member'),repeat('b',64));
 PERFORM pg_temp.mv_ok(r);
 PERFORM pg_temp.mv_ok(public.act_on_home_invitation((r->'invitation'->>'id')::uuid,NULL,pg_temp.mv_id(7),'accept'));
 IF NOT public.home_has_permission(h,'home.view',pg_temp.mv_id(7)) THEN RAISE EXCEPTION 'Reissued invitation failed to recover'; END IF;
 UPDATE public."Home" SET security_state='frozen' WHERE id=h;
 IF public.home_record_context(h,pg_temp.mv_id(7))->>'allowed'='true' THEN RAISE EXCEPTION 'Frozen Home admitted'; END IF;
 UPDATE public."Home" SET security_state='normal',home_status='archived' WHERE id=h;
 IF public.home_record_context(h,pg_temp.mv_id(7))->>'allowed'='true' THEN RAISE EXCEPTION 'Archived Home admitted'; END IF;
 IF (SELECT jsonb_agg(to_jsonb(rp) ORDER BY rp.role_base,rp.permission) FROM public."HomeRolePermission"rp)
   IS DISTINCT FROM (SELECT rows FROM member_view_defaults_before) THEN RAISE EXCEPTION 'Admission mutated role policy'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: real invitation admission, minimal view defaults, explicit denies, current windows and old-policy recovery' AS result;
