-- Actual Home/item binding, current locked permission and atomic checklist audit.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION pg_temp.hs_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('ddc24000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
CREATE FUNCTION pg_temp.hs_expect(r jsonb,c text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF (c IS NULL AND r->>'ok' IS DISTINCT FROM 'true') OR (c IS NOT NULL AND r->>'code' IS DISTINCT FROM c) THEN
  RAISE EXCEPTION 'Expected %, got %',coalesce(c,'success'),r; END IF;
END $$;
INSERT INTO auth.users(id,email,email_confirmed_at)
 SELECT pg_temp.hs_id(n),'summary-contract-'||n||'@example.invalid',now() FROM generate_series(1,3)n;
INSERT INTO public."User"(id,email,username,role)
 SELECT id,email,'summary_contract_'||right(id::text,1),'user' FROM auth.users WHERE id::text LIKE 'ddc24000-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode)
 SELECT pg_temp.hs_id(100+n),pg_temp.hs_id(n),pg_temp.hs_id(n),'Private summary fixture','Test','WA','98607' FROM generate_series(1,2)n;
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,start_at,end_at)
 SELECT pg_temp.hs_id(100+n),pg_temp.hs_id(n),'owner','owner','adult','verified',now()-interval '1 day',now()+interval '1 day' FROM generate_series(1,2)n;
INSERT INTO public."HomeSeasonalChecklistItem"(id,home_id,season_key,year,item_key,title)
 SELECT pg_temp.hs_id(200+n),pg_temp.hs_id(CASE WHEN n=2 THEN 102 ELSE 101 END),'fall_prep',2026,'fixture_'||n,'Private checklist fixture' FROM generate_series(1,5)n;
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.hs_id(101); a uuid:=pg_temp.hs_id(1); r jsonb; first_row jsonb; n integer; BEGIN
 IF has_table_privilege('anon','public."HomeSeasonalChecklistItem"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_table_privilege('authenticated','public."HomeSeasonalChecklistItem"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_function_privilege('authenticated','public.update_home_seasonal_item(uuid,uuid,uuid,text)','EXECUTE')
  OR NOT has_function_privilege('service_role','public.update_home_seasonal_item(uuid,uuid,uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Unsafe seasonal item privileges'; END IF;
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,a,pg_temp.hs_id(202),'completed'),'HOME_CHECKLIST_NOT_FOUND');
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,a,pg_temp.hs_id(999),'completed'),'HOME_CHECKLIST_NOT_FOUND');
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,a,pg_temp.hs_id(201),'hired'),'HOME_CHECKLIST_INVALID');
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,pg_temp.hs_id(3),pg_temp.hs_id(201),'completed'),'HOME_CHECKLIST_DENIED');
 UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=h;
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,a,pg_temp.hs_id(201),'completed'),'HOME_CHECKLIST_DENIED');
 UPDATE public."HomeOccupancy" SET is_active=true,age_band='child' WHERE home_id=h;
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,a,pg_temp.hs_id(201),'completed'),'HOME_CHECKLIST_DENIED');
 UPDATE public."HomeOccupancy" SET age_band='adult',start_at=now()+interval '1 day' WHERE home_id=h;
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,a,pg_temp.hs_id(201),'completed'),'HOME_CHECKLIST_DENIED');
 UPDATE public."HomeOccupancy" SET start_at=now()-interval '1 day' WHERE home_id=h;
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,a,'home.edit',false);
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,a,pg_temp.hs_id(201),'completed'),'HOME_CHECKLIST_DENIED');
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h;
 UPDATE public."Home" SET security_state='frozen' WHERE id=h;
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,a,pg_temp.hs_id(201),'completed'),'HOME_CHECKLIST_DENIED');
 UPDATE public."Home" SET security_state='normal' WHERE id=h;
 IF EXISTS(SELECT FROM public."HomeAuditLog" WHERE home_id=h) OR EXISTS(SELECT FROM public."HomeSeasonalChecklistItem"
  WHERE home_id IN(h,pg_temp.hs_id(102)) AND status<>'pending') THEN RAISE EXCEPTION 'Denied update changed data'; END IF;
 r:=public.update_home_seasonal_item(h,a,pg_temp.hs_id(201),'completed'); PERFORM pg_temp.hs_expect(r);
 IF r->>'changed'<>'true' OR r->'item'->>'completed_by'<>a::text OR r->'item'->>'completed_at' IS NULL THEN RAISE EXCEPTION 'Missing completion provenance'; END IF;
 first_row:=r->'item';
 r:=public.update_home_seasonal_item(h,a,pg_temp.hs_id(201),'completed'); PERFORM pg_temp.hs_expect(r);
 IF r->>'changed'<>'false' OR r->'item'<>first_row THEN RAISE EXCEPTION 'Identical repeat changed original completion'; END IF;
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,a,pg_temp.hs_id(201),'skipped'),'HOME_CHECKLIST_CHANGED');
 UPDATE public."HomeSeasonalChecklistItem" SET status='hired' WHERE id=pg_temp.hs_id(203);
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,a,pg_temp.hs_id(203),'completed'),'HOME_CHECKLIST_LINKED');
 UPDATE public."HomeSeasonalChecklistItem" SET gig_id=pg_temp.hs_id(999) WHERE id=pg_temp.hs_id(204);
 PERFORM pg_temp.hs_expect(public.update_home_seasonal_item(h,a,pg_temp.hs_id(204),'skipped'),'HOME_CHECKLIST_LINKED');
 SELECT count(*) INTO n FROM public."HomeAuditLog" WHERE home_id=h;
 IF n<>1 THEN RAISE EXCEPTION 'Unexpected checklist audit count %',n; END IF;
END $$;
RESET ROLE;
CREATE FUNCTION pg_temp.hs_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.action='home_checklist_updated' THEN RAISE EXCEPTION 'Synthetic summary audit failure'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER summary_contract_audit_failure BEFORE INSERT ON public."HomeAuditLog"
 FOR EACH ROW EXECUTE FUNCTION pg_temp.hs_fail_audit();
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM public.update_home_seasonal_item(pg_temp.hs_id(101),pg_temp.hs_id(1),pg_temp.hs_id(205),'skipped');
  RAISE EXCEPTION 'Expected audit failure';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Synthetic summary audit failure' THEN RAISE; END IF;
 END;
 IF (SELECT status FROM public."HomeSeasonalChecklistItem" WHERE id=pg_temp.hs_id(205))<>'pending'
  OR EXISTS(SELECT FROM public."HomeAuditLog" WHERE target_id=pg_temp.hs_id(205)) THEN RAISE EXCEPTION 'Audit failure left partial change'; END IF;
END $$;
ROLLBACK;
