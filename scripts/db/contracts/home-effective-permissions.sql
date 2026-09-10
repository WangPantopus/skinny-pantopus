-- Effective shared Home access uses shipped role rows, current residency and
-- age ceilings. Explicit scoped external grants/direct owner RLS are separate.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, extensions, pg_catalog;
CREATE TEMP TABLE effective_reference_before AS
  SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base, permission) AS rows FROM public."HomeRolePermission" r;
DO $$ BEGIN
  IF (SELECT count(*) FROM public."HomeRolePermission") <> 24 THEN
    RAISE EXCEPTION 'Contract requires the exact shipped role reference count';
  END IF;
  IF has_function_privilege('authenticated', 'public.home_effective_access(uuid,uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.home_effective_access(uuid,uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.home_effective_access(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Effective resolver must remain service-only';
  END IF;
END $$;

INSERT INTO auth.users (id, email)
SELECT ('ddb00000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'effective-home-' || n || '@example.invalid' FROM generate_series(1, 12) n;
INSERT INTO public."User" (id, email, username, name)
SELECT id, email, 'effective_home_' || right(id::text, 2), 'Effective Home fixture'
FROM auth.users WHERE id::text LIKE 'ddb00000-0000-4000-8000-%';
INSERT INTO public."Home" (id, owner_id, address, city, state, zipcode)
VALUES
  ('ddb00000-0000-4000-8000-000000000101', 'ddb00000-0000-4000-8000-000000000001', '101 Synthetic Street', 'Test', 'WA', '98607'),
  ('ddb00000-0000-4000-8000-000000000102', NULL, '102 Synthetic Street', 'Test', 'WA', '98607'),
  ('ddb00000-0000-4000-8000-000000000103', 'ddb00000-0000-4000-8000-000000000011', '103 Synthetic Street', 'Test', 'WA', '98607');
INSERT INTO public."HomeOccupancy" (home_id, user_id, role, role_base, age_band, verification_status)
SELECT 'ddb00000-0000-4000-8000-000000000101',
  ('ddb00000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, legacy,
  base::public.home_role_base, age::public.home_age_band, status
FROM (VALUES
  (1, 'member', 'member', 'adult', 'verified'),
  (2, 'lease_resident', 'lease_resident', 'adult', 'verified'),
  (3, 'lease_resident', 'lease_resident', 'child', 'verified'),
  (4, 'owner', 'owner', 'teen', 'verified'),
  (6, 'service_provider', 'service_provider', 'adult', 'verified'),
  (7, 'tenant', NULL, NULL, 'verified'),
  (8, NULL, NULL, 'adult', 'verified'),
  (10, 'owner', 'owner', 'adult', 'provisional_bootstrap'),
  (12, 'member', 'member', 'adult', 'verified')
) r(n, legacy, base, age, status);
INSERT INTO public."HomeOwner" (home_id, subject_id, owner_status)
VALUES ('ddb00000-0000-4000-8000-000000000102', 'ddb00000-0000-4000-8000-000000000009', 'verified'),
  ('ddb00000-0000-4000-8000-000000000101', 'ddb00000-0000-4000-8000-000000000010', 'verified');

SET LOCAL ROLE service_role;
DO $$
DECLARE h uuid := 'ddb00000-0000-4000-8000-000000000101';
  u uuid := 'ddb00000-0000-4000-8000-000000000002';
  a jsonb; state text; perms text[]; original public."HomeOccupancy"%ROWTYPE;
BEGIN
  perms := public.home_get_user_permissions(h,u);
  IF cardinality(perms) <> 8 OR NOT ('tasks.edit' = ANY(perms)) OR 'docs.upload' = ANY(perms) THEN
    RAISE EXCEPTION 'Exact shipped lease defaults changed';
  END IF;
  IF cardinality(public.home_get_user_permissions(h, 'ddb00000-0000-4000-8000-000000000012')) <> 0 THEN
    RAISE EXCEPTION 'Resolver invented member defaults';
  END IF;
  IF NOT public.home_is_active_member(h, 'ddb00000-0000-4000-8000-000000000012') THEN
    RAISE EXCEPTION 'Membership fact should not invent or require a permission default';
  END IF;
  IF public.home_has_permission(h, 'tasks.edit', 'ddb00000-0000-4000-8000-000000000003')
    OR NOT public.home_has_permission(h, 'tasks.view', 'ddb00000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'Child inherited a write from the real lease defaults';
  END IF;
  IF NOT public.home_has_permission(h, 'tasks.edit', 'ddb00000-0000-4000-8000-000000000007')
    OR public.home_my_role(h, 'ddb00000-0000-4000-8000-000000000007') <> 'lease_resident' THEN
    RAISE EXCEPTION 'Known legacy alias or unknown-age compatibility lost';
  END IF;
  IF public.home_is_active_member(h, 'ddb00000-0000-4000-8000-000000000008')
    OR public.home_is_active_member(h, 'ddb00000-0000-4000-8000-000000000010') THEN
    RAISE EXCEPTION 'Unknown role or provisional verified-owner record admitted shared access';
  END IF;
  IF public.home_role_rank('lease_resident') <> 35 OR public.home_role_rank('service_provider') <> 5
    OR public.home_role_rank(NULL) <> 0 THEN RAISE EXCEPTION 'Known role ranks incomplete'; END IF;
  IF NOT public.home_has_role_at_least(h, 'member', u)
    OR public.home_has_role_at_least(h, 'guest', 'ddb00000-0000-4000-8000-000000000006') THEN
    RAISE EXCEPTION 'Role comparison does not respect lease/provider rank';
  END IF;
  a := public.home_effective_access(h, 'ddb00000-0000-4000-8000-000000000001');
  IF a->>'role_base' <> 'member' OR a->>'effective_role_base' <> 'owner'
    OR a->>'is_owner' <> 'true' OR jsonb_array_length(a->'permissions') <> cardinality(enum_range(NULL::public.home_permission)) THEN
    RAISE EXCEPTION 'Adult owner entitlement lost or recorded role overwritten';
  END IF;
  IF NOT public.home_has_permission('ddb00000-0000-4000-8000-000000000102', 'ownership.manage', 'ddb00000-0000-4000-8000-000000000009')
    OR NOT public.home_has_permission('ddb00000-0000-4000-8000-000000000103', 'ownership.manage', 'ddb00000-0000-4000-8000-000000000011') THEN
    RAISE EXCEPTION 'Independent verified or legacy owner without occupancy lost rights';
  END IF;
  -- Every invalid current occupancy fences membership, permissions and role,
  -- even though an explicit grant or an independent owner proof could exist.
  FOREACH state IN ARRAY ARRAY['unverified','pending_postcard','pending_doc','provisional_bootstrap','suspended','inactive','moved_out','revoked','unknown',NULL] LOOP
    UPDATE public."HomeOccupancy" SET verification_status = state WHERE home_id=h AND user_id=u;
    IF public.home_is_active_member(h,u) OR cardinality(public.home_get_user_permissions(h,u)) <> 0
      OR public.home_my_role(h,u) IS NOT NULL OR public.home_can_see_visibility(h,'public',u) THEN
      RAISE EXCEPTION 'Invalid verification status admitted shared access: %', state;
    END IF;
  END LOOP;
  UPDATE public."HomeOccupancy" SET verification_status='verified' WHERE home_id=h AND user_id=u;
  UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=h AND user_id=u;
  IF public.home_is_active_member(h,u) THEN RAISE EXCEPTION 'Inactive occupancy allowed'; END IF;
  UPDATE public."HomeOccupancy" SET is_active=true, start_at=now()+interval '1 hour' WHERE home_id=h AND user_id=u;
  IF public.home_is_active_member(h,u) THEN RAISE EXCEPTION 'Future membership allowed'; END IF;
  UPDATE public."HomeOccupancy" SET start_at=now(), end_at=now() WHERE home_id=h AND user_id=u;
  IF public.home_is_active_member(h,u) THEN RAISE EXCEPTION 'Ended membership allowed at boundary'; END IF;
  UPDATE public."HomeOccupancy" SET end_at=NULL, access_start_at=now()+interval '1 hour' WHERE home_id=h AND user_id=u;
  IF public.home_is_active_member(h,u) THEN RAISE EXCEPTION 'Future access window allowed'; END IF;
  UPDATE public."HomeOccupancy" SET access_start_at=now(), access_end_at=now() WHERE home_id=h AND user_id=u;
  IF public.home_is_active_member(h,u) THEN RAISE EXCEPTION 'Ended access allowed at boundary'; END IF;
  UPDATE public."HomeOccupancy" SET access_end_at=NULL, verified_at=NULL, verification_expires_at=now()-interval '1 day' WHERE home_id=h AND user_id=u;
  IF NOT public.home_is_active_member(h,u) THEN RAISE EXCEPTION 'Verification-age rollout was silently enabled'; END IF;
  -- Resolving permissions cannot mutate membership, verification age or flags.
  SELECT * INTO original FROM public."HomeOccupancy" WHERE home_id=h AND user_id=u;
  PERFORM public.home_get_user_permissions(h,u);
  IF (SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=u) IS DISTINCT FROM to_jsonb(original) THEN
    RAISE EXCEPTION 'Permission read mutated occupancy';
  END IF;
  UPDATE public."HomeOccupancy" SET access_end_at=now() WHERE home_id=h AND user_id='ddb00000-0000-4000-8000-000000000001';
  IF public.home_is_active_member(h,'ddb00000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Legacy owner bypassed expired existing occupancy';
  END IF;
  UPDATE public."HomeOccupancy" SET access_end_at=NULL WHERE home_id=h AND user_id='ddb00000-0000-4000-8000-000000000001';
  UPDATE public."HomeOccupancy" SET age_band='child' WHERE home_id=h AND user_id='ddb00000-0000-4000-8000-000000000001';
  a := public.home_effective_access(h,'ddb00000-0000-4000-8000-000000000001');
  IF a->>'is_owner' <> 'false' OR a->>'effective_role_base' <> 'restricted_member'
    OR public.home_has_permission(h,'tasks.edit','ddb00000-0000-4000-8000-000000000001')
    OR NOT public.home_has_permission(h,'tasks.view','ddb00000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Child legacy ownership bypassed its ceiling';
  END IF;
  UPDATE public."HomeOccupancy" SET age_band='adult' WHERE home_id=h AND user_id='ddb00000-0000-4000-8000-000000000001';
END $$;
RESET ROLE;

-- Scoped fixture overrides exercise every enum without adding global defaults.
INSERT INTO public."HomePermissionOverride" (home_id, user_id, permission, allowed)
SELECT 'ddb00000-0000-4000-8000-000000000101', u, p, true
FROM unnest(ARRAY['ddb00000-0000-4000-8000-000000000003'::uuid,
  'ddb00000-0000-4000-8000-000000000004'::uuid]) u,
  unnest(enum_range(NULL::public.home_permission)) p;
INSERT INTO public."HomePermissionOverride" (home_id, user_id, permission, allowed)
VALUES ('ddb00000-0000-4000-8000-000000000101', 'ddb00000-0000-4000-8000-000000000001', 'finance.manage', false),
  ('ddb00000-0000-4000-8000-000000000101', 'ddb00000-0000-4000-8000-000000000002', 'tasks.edit', false);
SET LOCAL ROLE service_role;
DO $$
DECLARE h uuid := 'ddb00000-0000-4000-8000-000000000101'; u uuid; a jsonb;
  child_perms text[] := ARRAY['home.view','members.view','tasks.view','calendar.view','docs.view','packages.view','maintenance.view','assets.view','devices.view','vendors.view'];
  teen_perms text[]; actual text[];
BEGIN
  teen_perms := child_perms || ARRAY['tasks.edit','calendar.edit','docs.upload','maintenance.edit','packages.edit'];
  FOR n IN 3..4 LOOP
    u := ('ddb00000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
    a := public.home_effective_access(h,u); actual := public.home_get_user_permissions(h,u);
    IF cardinality(actual) <> (CASE n WHEN 3 THEN cardinality(child_perms) ELSE cardinality(teen_perms) END)
      OR NOT actual <@ (CASE n WHEN 3 THEN child_perms ELSE teen_perms END)
      OR a->>'is_owner' <> 'false' OR public.home_has_role_at_least(h,'manager',u)
      OR public.home_can_see_visibility(h,'managers',u) OR public.home_can_see_visibility(h,'sensitive',u) THEN
      RAISE EXCEPTION 'Minor ceiling was bypassed by role, grant or visibility: %', n;
    END IF;
  END LOOP;
  IF public.home_has_permission(h,'finance.manage','ddb00000-0000-4000-8000-000000000001')
    OR public.home_has_permission(h,'tasks.edit','ddb00000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Explicit deny lost to owner or role';
  END IF;
END $$;
RESET ROLE;

DO $defaults$ BEGIN
  BEGIN
INSERT INTO public."HomeRolePermission" (role_base, permission, allowed)
VALUES ('owner','docs.upload',false),('member','home.view',false)
ON CONFLICT (role_base, permission) DO UPDATE SET allowed=EXCLUDED.allowed;
INSERT INTO public."HomePermissionOverride" (home_id,user_id,permission,allowed)
VALUES ('ddb00000-0000-4000-8000-000000000101','ddb00000-0000-4000-8000-000000000012','home.view',true);
  IF public.home_has_permission('ddb00000-0000-4000-8000-000000000101','docs.upload','ddb00000-0000-4000-8000-000000000001')
    OR NOT public.home_has_permission('ddb00000-0000-4000-8000-000000000101','home.view','ddb00000-0000-4000-8000-000000000012')
    OR NOT public.home_has_permission('ddb00000-0000-4000-8000-000000000101','home.view','ddb00000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Owner defaults, explicit grant precedence or recorded-role distinction changed';
  END IF;
INSERT INTO public."HomePermissionOverride" (home_id,user_id,permission,allowed)
VALUES ('ddb00000-0000-4000-8000-000000000101','ddb00000-0000-4000-8000-000000000001','docs.upload',true);
  IF NOT public.home_has_permission('ddb00000-0000-4000-8000-000000000101','docs.upload','ddb00000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Explicit owner grant could not override a role default deny';
  END IF;
    RAISE EXCEPTION 'Roll back scoped role default probes' USING ERRCODE = 'P0002';
  EXCEPTION WHEN no_data_found THEN NULL; END;
END $defaults$;

-- Legacy finance mutation policies must not turn a read-only IAM override
-- into authority to insert, change or remove household financial records.
INSERT INTO public."HomePermissionOverride" (home_id,user_id,permission,allowed)
VALUES ('ddb00000-0000-4000-8000-000000000101','ddb00000-0000-4000-8000-000000000012','finance.view',true);
INSERT INTO public."HomeBill" (id,home_id,bill_type,amount,created_by)
VALUES ('ddb00000-0000-4000-8000-000000000301','ddb00000-0000-4000-8000-000000000101',
  'other',10,'ddb00000-0000-4000-8000-000000000001');
INSERT INTO public."HomeSubscription" (id,home_id,service_name,cost,renewal_date,created_by)
VALUES ('ddb00000-0000-4000-8000-000000000302','ddb00000-0000-4000-8000-000000000101',
  'Synthetic subscription',10,CURRENT_DATE,'ddb00000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ddb00000-0000-4000-8000-000000000012',true);
DO $finance_read_only$
DECLARE h uuid := 'ddb00000-0000-4000-8000-000000000101';
  u uuid := 'ddb00000-0000-4000-8000-000000000012';
  relation text; affected integer; existing_id uuid;
BEGIN
  IF NOT public.home_has_permission(h,'finance.view') OR public.home_has_permission(h,'finance.manage') THEN
    RAISE EXCEPTION 'Read-only finance fixture permissions are incorrect';
  END IF;
  FOREACH relation IN ARRAY ARRAY['HomeBill','HomeSubscription'] LOOP
    existing_id := CASE relation WHEN 'HomeBill' THEN 'ddb00000-0000-4000-8000-000000000301'::uuid
      ELSE 'ddb00000-0000-4000-8000-000000000302'::uuid END;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',relation) INTO affected USING existing_id;
    IF affected <> 1 THEN RAISE EXCEPTION 'Finance viewer lost the existing % read',relation; END IF;
    BEGIN
      IF relation = 'HomeBill' THEN
        INSERT INTO public."HomeBill" (home_id,bill_type,amount,created_by) VALUES (h,'other',20,u);
      ELSE
        INSERT INTO public."HomeSubscription" (home_id,service_name,cost,renewal_date,created_by)
          VALUES (h,'Forbidden subscription',20,CURRENT_DATE,u);
      END IF;
      RAISE EXCEPTION 'Read-only finance viewer inserted % through RLS',relation;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    EXECUTE format('UPDATE public.%I SET details=''{}''::jsonb WHERE id=$1',relation) USING existing_id;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Read-only finance viewer updated % through RLS',relation; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',relation) USING existing_id;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Read-only finance viewer deleted % through RLS',relation; END IF;
  END LOOP;
  IF public.has_home_permission(h,'manage_finance') OR public.home_member_can(h,'manage_finance') THEN
    RAISE EXCEPTION 'Legacy finance-management wrapper elevated read-only permission';
  END IF;
END $finance_read_only$;
RESET ROLE;
-- A real management grant still permits these operations. The positive control
-- rules out broken fixtures, blanket table revocation or a nonfunctional policy.
INSERT INTO public."HomePermissionOverride" (home_id,user_id,permission,allowed)
VALUES ('ddb00000-0000-4000-8000-000000000101','ddb00000-0000-4000-8000-000000000012','finance.manage',true);
SET LOCAL ROLE authenticated;
DO $finance_manager$
DECLARE h uuid := 'ddb00000-0000-4000-8000-000000000101';
  u uuid := 'ddb00000-0000-4000-8000-000000000012';
  relation text; affected integer; inserted_id uuid;
BEGIN
  IF NOT public.has_home_permission(h,'manage_finance') OR NOT public.home_member_can(h,'manage_finance') THEN
    RAISE EXCEPTION 'Legacy wrapper lost a current finance-management grant';
  END IF;
  FOREACH relation IN ARRAY ARRAY['HomeBill','HomeSubscription'] LOOP
    IF relation = 'HomeBill' THEN
      INSERT INTO public."HomeBill" (home_id,bill_type,amount,created_by)
        VALUES (h,'other',20,u) RETURNING id INTO inserted_id;
    ELSE
      INSERT INTO public."HomeSubscription" (home_id,service_name,cost,renewal_date,created_by)
        VALUES (h,'Permitted subscription',20,CURRENT_DATE,u) RETURNING id INTO inserted_id;
    END IF;
    EXECUTE format('UPDATE public.%I SET details=''{}''::jsonb WHERE id=$1',relation) USING inserted_id;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'Finance manager could not update its inserted %',relation; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',relation) USING inserted_id;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'Finance manager could not delete its inserted %',relation; END IF;
  END LOOP;
END $finance_manager$;
RESET ROLE;

INSERT INTO public."HomeDocument" (id,home_id,created_by,doc_type,title,visibility)
SELECT ('ddb00000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'ddb00000-0000-4000-8000-000000000101','ddb00000-0000-4000-8000-000000000003','other','Synthetic private document',visibility::public.home_record_visibility
FROM (VALUES (201,'members'),(202,'managers'),(203,'sensitive'),(204,'public')) f(n,visibility);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ddb00000-0000-4000-8000-000000000003',true);
DO $$
DECLARE h uuid := 'ddb00000-0000-4000-8000-000000000101'; affected integer;
BEGIN
  IF NOT public.home_is_active_member(h) OR public.home_my_role(h) <> 'restricted_member'
    OR NOT public.is_home_member(h) OR public.has_home_permission(h,'manage_tasks')
    OR public.home_member_can(h,'view_sensitive') THEN RAISE EXCEPTION 'Own-safe legacy wrappers disagree'; END IF;
  IF (SELECT count(*) FROM public."HomeDocument" WHERE home_id=h) <> 2 THEN
    RAISE EXCEPTION 'Real child document RLS visibility or recursion boundary failed: % rows; permissions %', (SELECT count(*) FROM public."HomeDocument" WHERE home_id=h), public.home_get_user_permissions(h);
  END IF;
  UPDATE public."HomeDocument" SET title='Should not change' WHERE id='ddb00000-0000-4000-8000-000000000201';
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Child updated its own document through RLS'; END IF;
  IF public.home_is_active_member(h,'ddb00000-0000-4000-8000-000000000001')
    OR public.home_has_permission(h,'ownership.manage','ddb00000-0000-4000-8000-000000000001')
    OR cardinality(public.home_get_user_permissions(h,'ddb00000-0000-4000-8000-000000000001')) <> 0
    OR public.home_my_role(h,'ddb00000-0000-4000-8000-000000000001') IS NOT NULL
    OR public.home_has_role_at_least(h,'owner','ddb00000-0000-4000-8000-000000000001')
    OR public.home_can_see_visibility(h,'public','ddb00000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Authenticated caller learned another user permission or role state';
  END IF;
  BEGIN
    PERFORM public.home_effective_access(h,'ddb00000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'Authenticated role invoked service-only resolver';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','ddb00000-0000-4000-8000-000000000005',true);
DO $$ BEGIN
  IF public.home_my_role('ddb00000-0000-4000-8000-000000000101') IS NOT NULL
    OR public.home_can_see_visibility('ddb00000-0000-4000-8000-000000000101','public')
    OR EXISTS (SELECT FROM public."HomeDocument" WHERE home_id='ddb00000-0000-4000-8000-000000000101') THEN
    RAISE EXCEPTION 'Outsider gained default guest role or public Home document visibility';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
  IF public.home_is_active_member('ddb00000-0000-4000-8000-000000000101','ddb00000-0000-4000-8000-000000000001')
    OR public.home_can_see_visibility('ddb00000-0000-4000-8000-000000000101','public') THEN
    RAISE EXCEPTION 'Anonymous caller inspected private membership';
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission" r)
    IS DISTINCT FROM (SELECT rows FROM effective_reference_before) THEN
    RAISE EXCEPTION 'Role reference rows changed';
  END IF;
END $$;
ROLLBACK;
SELECT 'PASS: exact defaults, current shared residency, age/owner/override ceilings, own-safe wrappers, finance read/write boundaries and HomeDocument RLS' AS result;
