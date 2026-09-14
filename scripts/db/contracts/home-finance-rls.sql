-- Finance RLS must honor exact read/write permissions independently of Home
-- editing, ownership, split assignment, stale flags and overlapping old policy.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, extensions, pg_catalog;
CREATE TEMP TABLE finance_reference_before AS
  SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) AS rows FROM public."HomeRolePermission" r;

INSERT INTO auth.users (id,email)
SELECT ('ddf10000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'finance-rls-' || n || '@example.invalid' FROM generate_series(1,10) n;
INSERT INTO public."User" (id,email,username,name)
SELECT id,email,'finance_rls_' || right(id::text,2),'Finance RLS fixture'
FROM auth.users WHERE id::text LIKE 'ddf10000-0000-4000-8000-%';
INSERT INTO public."Home" (id,owner_id,address,city,state,zipcode)
VALUES ('ddf10000-0000-4000-8000-000000000101','ddf10000-0000-4000-8000-000000000001','101 Synthetic Street','Test','WA','98607'),
  ('ddf10000-0000-4000-8000-000000000102','ddf10000-0000-4000-8000-000000000010','102 Synthetic Street','Test','WA','98607');
INSERT INTO public."HomeOccupancy" (home_id,user_id,role,role_base,verification_status,age_band,
  is_active,can_manage_home,can_manage_finance,access_end_at)
SELECT 'ddf10000-0000-4000-8000-000000000101',
  ('ddf10000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  CASE WHEN n IN (1,6,9) THEN 'owner' ELSE 'member' END,
  (CASE WHEN n IN (1,6,9) THEN 'owner' ELSE 'member' END)::public.home_role_base,
  'verified',(CASE WHEN n=6 THEN 'child' ELSE 'adult' END)::public.home_age_band,
  true,true,true,CASE WHEN n=7 THEN now() ELSE NULL END
FROM generate_series(1,9) n;
INSERT INTO public."HomePermissionOverride" (home_id,user_id,permission,allowed)
SELECT 'ddf10000-0000-4000-8000-000000000101',
  ('ddf10000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  permission::public.home_permission,allowed
FROM (VALUES (1,'finance.view',false),(1,'finance.manage',false),(2,'home.edit',true),
  (3,'finance.view',true),(4,'finance.view',false),(4,'finance.manage',true),
  (5,'finance.view',true),(5,'finance.manage',true),
  (6,'finance.view',true),(6,'finance.manage',true),
  (7,'finance.view',true),(7,'finance.manage',true),(9,'finance.view',false)) o(n,permission,allowed);

INSERT INTO public."HomeBill" (id,home_id,bill_type,amount,created_by)
SELECT ('ddf10000-0000-4000-8000-' || lpad((200+n)::text,12,'0'))::uuid,
  ('ddf10000-0000-4000-8000-' || lpad((100+n)::text,12,'0'))::uuid,'other',10,
  'ddf10000-0000-4000-8000-000000000001' FROM generate_series(1,2) n;
INSERT INTO public."HomeSubscription" (id,home_id,service_name,cost,renewal_date,created_by)
SELECT ('ddf10000-0000-4000-8000-' || lpad((300+n)::text,12,'0'))::uuid,
  ('ddf10000-0000-4000-8000-' || lpad((100+n)::text,12,'0'))::uuid,'Synthetic subscription',10,CURRENT_DATE,
  'ddf10000-0000-4000-8000-000000000001' FROM generate_series(1,2) n;
INSERT INTO public."HomeBillSplit" (id,bill_id,user_id,share_amount)
SELECT ('ddf10000-0000-4000-8000-' || lpad((400+n)::text,12,'0'))::uuid,
  ('ddf10000-0000-4000-8000-' || lpad((200+n)::text,12,'0'))::uuid,
  'ddf10000-0000-4000-8000-000000000008',10 FROM generate_series(1,2) n;
CREATE TEMP TABLE finance_rows_before AS
SELECT 'HomeBill' AS relation,jsonb_agg(to_jsonb(b) ORDER BY id) AS rows FROM public."HomeBill" b
UNION ALL SELECT 'HomeSubscription',jsonb_agg(to_jsonb(s) ORDER BY id) FROM public."HomeSubscription" s
UNION ALL SELECT 'HomeBillSplit',jsonb_agg(to_jsonb(s) ORDER BY id) FROM public."HomeBillSplit" s;

SET LOCAL ROLE authenticated;
DO $matrix$
DECLARE h uuid := 'ddf10000-0000-4000-8000-000000000101';
  bill uuid := 'ddf10000-0000-4000-8000-000000000201';
  actor record; relation text; u uuid; original_id uuid; inserted_id uuid;
  affected integer; insert_sql text;
BEGIN
  FOR actor IN SELECT * FROM (VALUES
    (1,false,false,false,'owner with explicit finance denies'),
    (2,false,false,false,'Home editor'),
    (3,true,false,false,'finance viewer'),
    (4,false,true,false,'finance manager without view'),
    (5,true,true,true,'finance viewer and manager'),
    (6,false,false,false,'child owner with grants'),
    (7,false,false,false,'ended member with grants'),
    (8,false,false,false,'assigned split member without finance'),
    (9,false,true,false,'owner with explicit read deny'),
    (10,false,false,false,'outsider')
  ) a(n,can_read,can_insert,can_change,label) LOOP
    u := ('ddf10000-0000-4000-8000-' || lpad(actor.n::text,12,'0'))::uuid;
    PERFORM set_config('request.jwt.claim.sub',u::text,true);
    FOREACH relation IN ARRAY ARRAY['HomeBill','HomeSubscription','HomeBillSplit'] LOOP
      original_id := CASE relation WHEN 'HomeBill' THEN bill
        WHEN 'HomeSubscription' THEN 'ddf10000-0000-4000-8000-000000000301'::uuid
        ELSE 'ddf10000-0000-4000-8000-000000000401'::uuid END;
      EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',relation) INTO affected USING original_id;
      IF affected <> (CASE WHEN actor.can_read THEN 1 ELSE 0 END) THEN
        RAISE EXCEPTION '% has incorrect % read access: %',actor.label,relation,affected;
      END IF;
      inserted_id := gen_random_uuid();
      insert_sql := CASE relation
        WHEN 'HomeBill' THEN 'INSERT INTO public."HomeBill" (id,home_id,bill_type,amount,created_by) VALUES ($1,$2,''other'',20,$3)'
        WHEN 'HomeSubscription' THEN 'INSERT INTO public."HomeSubscription" (id,home_id,service_name,cost,renewal_date,created_by) VALUES ($1,$2,''Synthetic'',20,CURRENT_DATE,$3)'
        ELSE 'INSERT INTO public."HomeBillSplit" (id,bill_id,user_id,share_amount) VALUES ($1,$4,$3,20)' END;
      BEGIN
        EXECUTE insert_sql USING inserted_id,h,u,bill;
        IF NOT actor.can_insert THEN RAISE EXCEPTION '% inserted forbidden %',actor.label,relation; END IF;
        -- Roll back successful positive controls so other actors see identical records.
        RAISE EXCEPTION 'Rollback successful insertion probe' USING ERRCODE='P0002';
      EXCEPTION
        WHEN no_data_found THEN NULL;
        WHEN insufficient_privilege THEN
          IF actor.can_insert THEN RAISE EXCEPTION '% lost permitted % insertion',actor.label,relation; END IF;
      END;
      IF actor.can_insert AND NOT actor.can_read THEN
        BEGIN
          EXECUTE insert_sql || ' RETURNING id' INTO inserted_id USING inserted_id,h,u,bill;
          RAISE EXCEPTION '% read % through INSERT RETURNING',actor.label,relation;
        EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      END IF;
      BEGIN
        EXECUTE format('UPDATE public.%I SET %I=20 WHERE id=$1',relation,
          CASE relation WHEN 'HomeBill' THEN 'amount' WHEN 'HomeSubscription' THEN 'cost' ELSE 'share_amount' END)
          USING original_id;
        GET DIAGNOSTICS affected=ROW_COUNT;
        IF affected <> (CASE WHEN actor.can_change THEN 1 ELSE 0 END) THEN
          RAISE EXCEPTION '% has incorrect % update access: %',actor.label,relation,affected;
        END IF;
        RAISE EXCEPTION 'Rollback update probe' USING ERRCODE='P0002';
      EXCEPTION WHEN no_data_found THEN NULL; END;
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE id=$1',relation) USING original_id;
        GET DIAGNOSTICS affected=ROW_COUNT;
        IF affected <> (CASE WHEN actor.can_change THEN 1 ELSE 0 END) THEN
          RAISE EXCEPTION '% has incorrect % delete access: %',actor.label,relation,affected;
        END IF;
        RAISE EXCEPTION 'Rollback deletion probe' USING ERRCODE='P0002';
      EXCEPTION WHEN no_data_found THEN NULL; END;
    END LOOP;
  END LOOP;
END $matrix$;

SELECT set_config('request.jwt.claim.sub','ddf10000-0000-4000-8000-000000000005',true);
DO $foreign$
DECLARE relation text; affected integer; original_id uuid;
  h uuid := 'ddf10000-0000-4000-8000-000000000102';
  u uuid := 'ddf10000-0000-4000-8000-000000000005';
  bill uuid := 'ddf10000-0000-4000-8000-000000000202';
BEGIN
  IF public.home_bill_has_finance_permission(bill,'finance.view')
    OR public.home_bill_has_finance_permission(bill,'finance.manage')
    OR public.home_bill_has_finance_permission('ddf10000-0000-4000-8000-000000000201','home.edit')
    OR public.home_bill_has_finance_permission(gen_random_uuid(),'finance.manage') THEN
    RAISE EXCEPTION 'Split permission helper admitted a foreign/missing parent or arbitrary permission';
  END IF;
  FOREACH relation IN ARRAY ARRAY['HomeBill','HomeSubscription','HomeBillSplit'] LOOP
    original_id := CASE relation WHEN 'HomeBill' THEN 'ddf10000-0000-4000-8000-000000000201'::uuid
      WHEN 'HomeSubscription' THEN 'ddf10000-0000-4000-8000-000000000301'::uuid
      ELSE 'ddf10000-0000-4000-8000-000000000401'::uuid END;
    BEGIN
      IF relation='HomeBill' THEN
        INSERT INTO public."HomeBill" (home_id,bill_type,amount,created_by) VALUES (h,'other',10,u);
      ELSIF relation='HomeSubscription' THEN
        INSERT INTO public."HomeSubscription" (home_id,service_name,cost,renewal_date,created_by)
          VALUES (h,'Forbidden',10,CURRENT_DATE,u);
      ELSE
        INSERT INTO public."HomeBillSplit" (bill_id,user_id,share_amount) VALUES (bill,u,10);
      END IF;
      RAISE EXCEPTION 'Finance manager created a foreign Home %',relation;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      EXECUTE format('UPDATE public.%I SET %I=$1 WHERE id=$2',relation,
        CASE WHEN relation='HomeBillSplit' THEN 'bill_id' ELSE 'home_id' END)
        USING CASE WHEN relation='HomeBillSplit' THEN bill ELSE h END,original_id;
      GET DIAGNOSTICS affected=ROW_COUNT;
      IF affected <> 0 THEN RAISE EXCEPTION 'Finance manager moved % into a foreign Home',relation; END IF;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
END $foreign$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
  IF EXISTS (SELECT FROM public."HomeBill") OR EXISTS (SELECT FROM public."HomeSubscription")
    OR EXISTS (SELECT FROM public."HomeBillSplit") THEN RAISE EXCEPTION 'Anonymous finance read allowed'; END IF;
END $$;
RESET ROLE;
DO $preservation$
DECLARE v_relation text; actual jsonb;
BEGIN
  FOREACH v_relation IN ARRAY ARRAY['HomeBill','HomeSubscription','HomeBillSplit'] LOOP
    EXECUTE format('SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.%I r',v_relation) INTO actual;
    IF actual IS DISTINCT FROM (SELECT rows FROM finance_rows_before b WHERE b.relation=v_relation) THEN
      RAISE EXCEPTION 'Finance permission probes changed existing % rows',v_relation;
    END IF;
    IF has_table_privilege('authenticated',format('public.%I',v_relation),'TRUNCATE')
      OR has_table_privilege('anon',format('public.%I',v_relation),'TRUNCATE') THEN
      RAISE EXCEPTION 'Client retained TRUNCATE privilege outside finance RLS';
    END IF;
  END LOOP;
  IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission" r)
    IS DISTINCT FROM (SELECT rows FROM finance_reference_before) THEN RAISE EXCEPTION 'Role grants changed'; END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('HomeBill','HomeSubscription','HomeBillSplit')) <> 12
    OR EXISTS (SELECT FROM pg_policies WHERE schemaname='public'
      AND tablename IN ('HomeBill','HomeSubscription','HomeBillSplit') AND cmd='ALL') THEN
    RAISE EXCEPTION 'Overlapping finance policy remains';
  END IF;
  IF has_function_privilege('anon','public.home_bill_has_finance_permission(uuid,public.home_permission)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.home_bill_has_finance_permission(uuid,public.home_permission)','EXECUTE') THEN
    RAISE EXCEPTION 'Incorrect split permission helper privileges';
  END IF;
END $preservation$;
ROLLBACK;
SELECT 'PASS: finance RLS command separation, editor/owner/minor/revoked/foreign denials, positive controls and complete row preservation' AS result;
